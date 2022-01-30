import { ApiRecord, PektinClientConnectionConfig } from "../types";

export const jsTemp = (
    pccc: PektinClientConnectionConfig,
    redisEntries: ApiRecord[]
) => {
    // TODO
    /*
    return `const pc = new PektinClient({});
  const endpoint="${endpoint}";
  const res = await fetch(endpoint + "/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          token,
          records: 
                  ${JSON.stringify(
                    redisEntries,
                    null,
                    "    "
                  )}
      })
  }).catch(e => {
      console.log(e);
  });
  console.log(res);`;*/
};
