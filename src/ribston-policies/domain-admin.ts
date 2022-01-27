import {
    DeleteInput,
    GetInput,
    GetZoneInput as GetZoneRecordsInput,
    HealthInput,
    SearchInput,
    SetInput
} from "./ribston-types";

type Input = GetInput | GetZoneRecordsInput | DeleteInput | SetInput | SearchInput | HealthInput;

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

const domains = ["pektin.xyz."];

if (input.api_method === "get") {
    if (
        !input.request_body.Get.keys.every(key => {
            const inputDomain = key.replace(/\.\:.*$/, ".");
            for (const domain of domains) {
                if (inputDomain.endsWith(domain)) {
                    return true;
                }
            }
            return false;
        })
    ) {
        err("Invalid key");
    }
} else if (input.api_method === "delete" || input.api_method === "set") {
    const records =
        input.api_method === "delete"
            ? input.request_body.Delete.records
            : input.request_body.Set.records;
    if (
        !records.every(record => {
            for (const domain of domains) {
                if (record.name.endsWith(domain)) {
                    return true;
                }
            }
            return false;
        })
    ) {
        err("Invalid key");
    }
} else if (input.api_method === "search") {
    const inputDomain = input.request_body.Search.glob.substring(
        input.request_body.Search.glob.lastIndexOf(":")
    );
    let validDomain = false;
    for (const domain of domains) {
        if (inputDomain.endsWith(domain)) {
            validDomain = true;
        }
    }
    if (!validDomain) {
        err("Invalid key");
    }
} else {
    err(`API method '${input.api_method}' not allowed`);
}

if (output.error === undefined) {
    output.error = false;
    output.message = "Success";
}

// TODO make this easier
