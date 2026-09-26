ALTER TABLE public.visit_routes ADD COLUMN IF NOT EXISTS planning_request_key uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS visit_routes_planning_request_key_uidx ON public.visit_routes (planning_request_key);

-- Aproveita a chave real já gravada nas Observações (não inventa valores) e remove o texto técnico
UPDATE public.visit_routes
   SET planning_request_key = substring(notes from 'Ref\. planejamento: ([0-9a-f-]{36})')::uuid,
       notes = NULLIF(trim(regexp_replace(notes, '\n?Ref\. planejamento: [0-9a-f-]{36}', '', 'g')), '')
 WHERE planning_request_key IS NULL AND notes ~ 'Ref\. planejamento: [0-9a-f-]{36}';

CREATE OR REPLACE FUNCTION public.tg_lock_planning_request_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.planning_request_key IS DISTINCT FROM NEW.planning_request_key THEN
    NEW.planning_request_key := OLD.planning_request_key;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS lock_planning_request_key ON public.visit_routes;
CREATE TRIGGER lock_planning_request_key BEFORE UPDATE ON public.visit_routes
FOR EACH ROW EXECUTE FUNCTION public.tg_lock_planning_request_key();

CREATE OR REPLACE FUNCTION public.create_route_from_plan(
  _request_key uuid, _title text, _route_date date, _owner_id uuid, _vehicle_id uuid,
  _departure_time time, _available_minutes integer,
  _start_label text, _start_address text, _start_latitude double precision, _start_longitude double precision,
  _end_label text, _end_address text, _end_latitude double precision, _end_longitude double precision,
  _notes text, _lead_ids uuid[]
) RETURNS TABLE(route_id uuid, already_existed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _existing uuid;
  _new_id uuid;
  _n integer;
  _bad integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão expirada. Entre novamente.'; END IF;
  IF _request_key IS NULL THEN RAISE EXCEPTION 'Confirmação inválida.'; END IF;
  IF _route_date IS NULL THEN RAISE EXCEPTION 'Informe a data do roteiro.'; END IF;

  SELECT r.id INTO _existing FROM public.visit_routes r WHERE r.planning_request_key = _request_key;
  IF _existing IS NOT NULL THEN RETURN QUERY SELECT _existing, true; RETURN; END IF;

  _is_admin := public.has_role(_uid, 'admin');
  _owner_id := COALESCE(_owner_id, _uid);
  IF NOT _is_admin AND _owner_id <> _uid THEN
    RAISE EXCEPTION 'Você só pode criar roteiros para você mesmo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner_id AND p.active AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Responsável inválido ou inativo.';
  END IF;
  IF _vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = _vehicle_id AND v.active) THEN
    RAISE EXCEPTION 'Veículo inválido ou inativo.';
  END IF;

  _n := COALESCE(array_length(_lead_ids, 1), 0);
  IF _n = 0 THEN RAISE EXCEPTION 'A sequência está vazia.'; END IF;
  IF _n > 60 THEN RAISE EXCEPTION 'Limite de 60 paradas por roteiro.'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(_lead_ids) x) <> _n THEN
    RAISE EXCEPTION 'A sequência contém Leads repetidos.';
  END IF;

  SELECT count(*) INTO _bad FROM unnest(_lead_ids) x
   WHERE NOT EXISTS (
     SELECT 1 FROM public.leads l
      WHERE l.id = x AND l.deleted_at IS NULL AND public.can_access_lead(l.id)
        AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
        AND l.latitude BETWEEN -90 AND 90 AND l.longitude BETWEEN -180 AND 180
        AND NOT (l.latitude = 0 AND l.longitude = 0)
   );
  IF _bad > 0 THEN
    RAISE EXCEPTION '% Lead(s) da sequência não estão mais disponíveis (excluídos, sem acesso ou sem localização). Gere a sequência novamente.', _bad;
  END IF;

  -- Unicidade garantida pelo índice único: concorrentes com a mesma chave esperam e não inserem
  INSERT INTO public.visit_routes (
    title, route_date, owner_id, created_by, vehicle_id, departure_time, available_minutes,
    start_label, start_address, start_latitude, start_longitude,
    end_label, end_address, end_latitude, end_longitude, notes, planning_request_key
  ) VALUES (
    NULLIF(trim(_title), ''), _route_date, _owner_id, _uid, _vehicle_id, _departure_time, _available_minutes,
    NULLIF(trim(_start_label), ''), NULLIF(trim(_start_address), ''), _start_latitude, _start_longitude,
    NULLIF(trim(_end_label), ''), NULLIF(trim(_end_address), ''), _end_latitude, _end_longitude,
    NULLIF(trim(_notes), ''), _request_key
  )
  ON CONFLICT (planning_request_key) DO NOTHING
  RETURNING id INTO _new_id;

  IF _new_id IS NULL THEN
    SELECT r.id INTO _existing FROM public.visit_routes r WHERE r.planning_request_key = _request_key;
    IF _existing IS NULL THEN RAISE EXCEPTION 'Confirmação inválida.'; END IF;
    RETURN QUERY SELECT _existing, true; RETURN;
  END IF;

  INSERT INTO public.visit_route_stops (route_id, lead_id, sort_order, address, latitude, longitude)
  SELECT _new_id, l.id, u.ord,
         NULLIF(concat_ws(' · ',
           NULLIF(concat_ws(', ', NULLIF(l.street_name, ''), NULLIF(l.number, '')), ''),
           NULLIF(l.neighborhood_name, ''),
           NULLIF(concat_ws('/', NULLIF(l.city, ''), NULLIF(l.state, '')), '')), ''),
         l.latitude, l.longitude
    FROM unnest(_lead_ids) WITH ORDINALITY AS u(lead_id, ord)
    JOIN public.leads l ON l.id = u.lead_id;

  GET DIAGNOSTICS _bad = ROW_COUNT;
  IF _bad <> _n THEN RAISE EXCEPTION 'Falha ao criar todas as paradas. Nada foi gravado.'; END IF;

  RETURN QUERY SELECT _new_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_route_from_plan(uuid,text,date,uuid,uuid,time,integer,text,text,double precision,double precision,text,text,double precision,double precision,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_route_from_plan(uuid,text,date,uuid,uuid,time,integer,text,text,double precision,double precision,text,text,double precision,double precision,text,uuid[]) TO authenticated;