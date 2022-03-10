import { PektinRRType } from "../types.js";
import {
    DeleteInput,
    GetInput,
    GetZoneInput,
    HealthInput,
    SearchInput,
    SetInput,
} from "./ribston-types.js";

type Input = GetInput | GetZoneInput | DeleteInput | SetInput | SearchInput | HealthInput;

interface Output {
    status: string;
    message: string;
}

const input: Input = {} as Input;
const output: Output = {} as Output;
/* Your code goes beneath this */

const err = (msg: string) => {
    output.status = `ERROR`;
    output.message = msg;
};

if (input.api_method === `get`) {
    const allCallNamesValid = input.request_body.Get.records.every(
        (record) => record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT
    );
    if (!allCallNamesValid) {
        err(`Invalid key`);
    }
} else if (input.api_method === `delete` || input.api_method === `set`) {
    const records =
        input.api_method === `delete`
            ? input.request_body.Delete.records
            : input.request_body.Set.records;
    const allCallNamesValid = records.every(
        (record) => record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT
    );
    if (!allCallNamesValid) {
        err(`Invalid key`);
    }
} else {
    err(`API method '${input.api_method}' not allowed`);
}

if (output.status === undefined) {
    output.status = `SUCCESS`;
    output.message = `Success`;
}

output;
