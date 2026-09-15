CREATE OR REPLACE FUNCTION public.upsert_lead_search_link(
  _search_id uuid,
  _name text,
  _segment_id uuid,
  _segment_name text,
  _region text,
  _city text,
  _state text,
  _radius_km numeric,
  _requested int,
  _found int,
  _selected int,
  _imported int,
  _provider text,
  _status text,
  _notes text,
  _lead_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_expected int := COALESCE(array_length(_lead_ids, 1), 0);
  v_linked int := 0;
BEGIN
  IF _search_id IS NULL THEN
    INSERT INTO public.lead_searches (
      name, segment_id, segment_name, region, city, state, radius_km,
      requested_count, found_count, selected_count, imported_count,
      provider, status, notes, owner_id, created_by
    ) VALUES (
      _name, _segment_id, _segment_name, _region, _city, _state, _radius_km,
      COALESCE(_requested, 0), COALESCE(_found, 0), COALESCE(_selected, 0), COALESCE(_imported, 0),
      _provider, COALESCE(_status, 'arquivada'), _notes, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.lead_searches SET
      name = COALESCE(_name, name),
      segment_id = COALESCE(_segment_id, segment_id),
      segment_name = COALESCE(_segment_name, segment_name),
      region = COALESCE(_region, region),
      city = COALESCE(_city, city),
      state = COALESCE(_state, state),
      radius_km = COALESCE(_radius_km, radius_km),
      requested_count = COALESCE(_requested, requested_count),
      found_count = COALESCE(_found, found_count),
      selected_count = GREATEST(COALESCE(_selected, selected_count), selected_count),
      imported_count = GREATEST(COALESCE(_imported, imported_count), imported_count),
      provider = COALESCE(_provider, provider),
      status = COALESCE(_status, status),
      notes = COALESCE(_notes, notes),
      updated_at = now()
    WHERE id = _search_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Pesquisa não encontrada ou sem permissão de alteração';
    END IF;
  END IF;

  IF v_expected > 0 THEN
    UPDATE public.leads
       SET search_id = v_id
     WHERE id = ANY(_lead_ids)
       AND (search_id IS NULL OR search_id = v_id);
    GET DIAGNOSTICS v_linked = ROW_COUNT;

    IF v_linked <> v_expected THEN
      RAISE EXCEPTION 'Não foi possível vincular todos os Leads à pesquisa (% de %)', v_linked, v_expected;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_lead_search_link(uuid, text, uuid, text, text, text, text, numeric, int, int, int, int, text, text, text, uuid[]) TO authenticated;