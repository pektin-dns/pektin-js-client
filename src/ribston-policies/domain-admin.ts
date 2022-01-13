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

if (input.api_method === "get" || input.api_method === "delete") {
    const body = input.api_method === "get" ? input.request_body.Get : input.request_body.Delete;
    if (
        !body.keys.every(key => {
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
} else if (input.api_method === "set") {
    if (
        !input.request_body.Set.records.every(record => {
            const inputDomain = record.name.replace(/\.\:.*$/, ".");
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
