// psql text COPY double-escapes JSON backslashes. SELECT -At emits JSON intact.
export function rowsQuery(query){
  return `SET timezone='UTC';SET datestyle='ISO';SET search_path=public,pg_catalog;
    SELECT coalesce(json_agg(q),'[]'::json)::text FROM (${query}) q;`;
}
export function parseRows(output){
  const start=output.indexOf('[');
  if(start<0||!output.slice(0,start).split(/\r?\n/).every(line=>line===''||line==='SET'))throw new Error('LOCAL_RESULT_INVALID');
  const value=JSON.parse(output.slice(start).trim());if(!Array.isArray(value))throw new Error('LOCAL_RESULT_INVALID');
  return value;
}
