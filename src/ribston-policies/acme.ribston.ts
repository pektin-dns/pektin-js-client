import { PektinRRType } from "../types";
import {
    DeleteInput,
    GetInput,
    GetZoneInput,
    HealthInput,
    SearchInput,
    SetInput
} from "./ribston-types";

type Input = GetInput | GetZoneInput | DeleteInput | SetInput | SearchInput | HealthInput;

interface Output {
    error: boolean;
    message: string;
}

const input: Input = {} as Input;
const output: Output = {} as Output;
/* Your code goes beneath this */

const err = (msg: string) => {
    output.error = true;
    output.message = msg;
};

if (input.api_method === "get") {
    if (
        !input.request_body.Get.keys.every(
            key => key.startsWith("_acme-challenge") && key.endsWith(".:TXT")
        )
    ) {
        err("Invalid key");
    }
} else if (input.api_method === "delete") {
    if (
        !input.request_body.Delete.records.every(
            record =>
                record.name.startsWith("_acme-challenge") && record.rr_type === PektinRRType.TXT
        )
    ) {
        err("Invalid key");
    }
} else if (input.api_method === "set") {
    if (
        !input.request_body.Set.records.every(
            record =>
                record.name.startsWith("_acme-challenge") && record.rr_type === PektinRRType.TXT
        )
    ) {
        err("Invalid key");
    }
} else {
    err(`API method '${input.api_method}' not allowed`);
}

if (output.error === undefined) {
    output.error = false;
    output.message = "Success";
}
