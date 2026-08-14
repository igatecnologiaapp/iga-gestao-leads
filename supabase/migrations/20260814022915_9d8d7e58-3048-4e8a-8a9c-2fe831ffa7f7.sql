CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type commercial_doc_type, _doc_year integer DEFAULT NULL::integer)
 RETURNS TABLE(doc_year integer, doc_number integer, number_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  y integer := COALESCE(_doc_year, EXTRACT(YEAR FROM now())::int);
  n integer;
BEGIN
  INSERT INTO public.document_sequences AS ds (doc_type, doc_year, last_number)
  VALUES (_doc_type, y, 1)
  ON CONFLICT ON CONSTRAINT document_sequences_pkey DO UPDATE SET last_number = ds.last_number + 1
  RETURNING ds.last_number INTO n;
  doc_year := y;
  doc_number := n;
  number_label := lpad(n::text, 3, '0') || '-' || y::text;
  RETURN NEXT;
END;
$function$;