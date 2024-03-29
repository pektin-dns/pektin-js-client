import { PektinRRType } from "../types.js";
import { Input, Output } from "./ribston-types.js";
import { allow, deny, getBodyForApiMethod } from "./utils.js";

/*
POLICY INFORMATION
{
    "version": "1.0.0",
    "use":"pektin-dns",
    "name": "acme",
    "class": "acme",
    "contact": "pektin@y.gy"
}
*/

const input: Input = {} as Input;
const output: Output = {
    status: `UNDECIDED`,
    message: `Policy didn't reach a decission`,
};

/* Your code goes beneath this */

if (input.api_method === `get`) {
    const allRecordsValid = input.request_body.Get.records.every((record) => {
        return record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT;
    });

    if (allRecordsValid) {
        allow(output);
    } else {
        deny(output, `Name not allowed`);
    }
} else if (input.api_method === `delete` || input.api_method === `set`) {
    const body = getBodyForApiMethod(input);
    /*@ts-ignore*/
    const allRecordsValid = body.records.every((record) => {
        return record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT;
    });
    if (allRecordsValid) {
        allow(output);
    } else {
        deny(output, `Name not allowed`);
    }
} else if (input.api_method === `search`) {
    const allRecordsValid = input.request_body.Search.globs.every((record) => {
        return record.rr_type_glob === PektinRRType.SOA;
    });
    if (allRecordsValid) {
        allow(output);
    } else {
        deny(output, `rr_type_glob not allowed`);
    }
} else {
    deny(output, `API method '${input.api_method}' not allowed`);
}
