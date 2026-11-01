import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";

// Execute production server adapters against actual local PostgreSQL. Only Clerk
// context, Next runtime and the PostgREST wire transport are supplied by this harness.
export function loadServerModule(path, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sandbox = { exports: {} };
  vm.runInNewContext(compiled, {
    module: sandbox,
    exports: sandbox.exports,
    Buffer,
    URL,
    process,
    crypto,
    require(id) {
      if (id === "server-only") return {};
      if (id in dependencies) return dependencies[id];
      throw new Error("Unexpected test dependency: " + id);
    },
  });
  return sandbox.exports;
}
const identifier = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value))
    throw new Error("Invalid test SQL identifier");
  return '"' + value + '"';
};
export function postgresAdapter(client) {
  // One pg Client is sequential; true concurrency tests use independent clients.
  let pending = Promise.resolve();
  const query = (...args) => {
    const result = pending.then(() => client.query(...args));
    pending = result.catch(() => {});
    return result;
  };
  return {
    async rpc(name, { p_context, p_action, p_input }) {
      const signature = {
        chat_staff_link_configure: ["p_context", "p_input"],
        chat_configure: ["p_context", "p_action", "p_input"],
        chat_platform_configure: ["p_context", "p_action", "p_input"],
        chat_capabilities: ["p_context"],
        chat_publish_action_pack: ["p_context", "p_input"],
      }[name];
      if (!signature) throw new Error("Unexpected test RPC");
      const args = { p_context, p_action, p_input };
      try {
        return {
          data: (
            await query(
              "select " +
                identifier(name) +
                "(" +
                signature
                  .map(
                    (arg, index) =>
                      "$" +
                      (index + 1) +
                      (arg === "p_action" ? "::text" : "::jsonb"),
                  )
                  .join(",") +
                ") as result",
              signature.map((arg) =>
                arg === "p_action" ? args[arg] : JSON.stringify(args[arg]),
              ),
            )
          ).rows[0].result,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      const conditions = [],
        values = [];
      let columns = "*",
        order = "",
        limit = "",
        single = false;
      const builder = {
        select(value) {
          columns =
            value === "*" ? "*" : value.split(",").map(identifier).join(",");
          return builder;
        },
        eq(key, value) {
          values.push(value);
          conditions.push(identifier(key) + "=$" + values.length);
          return builder;
        },
        lt(key, value) {
          values.push(value);
          conditions.push(identifier(key) + "<$" + values.length);
          return builder;
        },
        is(key, value) {
          if (value !== null) throw new Error("Unsupported test is");
          conditions.push(identifier(key) + " is null");
          return builder;
        },
        order(key, { ascending = true } = {}) {
          order =
            " order by " + identifier(key) + (ascending ? " asc" : " desc");
          return builder;
        },
        limit(count) {
          if (!Number.isSafeInteger(count) || count < 0)
            throw new Error("Invalid limit");
          limit = " limit " + count;
          return builder;
        },
        maybeSingle() {
          single = true;
          return builder;
        },
        then(resolve, reject) {
          return query(
            "select " +
              columns +
              " from " +
              identifier(table) +
              (conditions.length ? " where " + conditions.join(" and ") : "") +
              order +
              limit,
            values,
          )
            .then(
              (result) => {
                // PostgREST serializes safe bigint identifiers as JSON numbers; pg returns text.
                const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => {
                  const field=result.fields.find(field=>field.name===key);
                  return [key,field?.dataTypeID===20 && typeof value==="string" && Number.isSafeInteger(Number(value)) ? Number(value) : value];
                })));
                return {data: single ? (rows[0] ?? null) : rows,error:null};
              },
              (error) => ({ data: null, error }),
            )
            .then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
