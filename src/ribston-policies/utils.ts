import { Input, Output } from "./ribston-types.js";

export const deny = (o: Output, msg: string) => {
    o.status = `ERROR`;
    o.message = msg;
};
export const allow = (o: Output, msg: string = `Success`) => {
    o.status = `SUCCESS`;
    o.message = msg;
};

export const getBodyForApiMethod = (input: Input) => {
    switch (input.api_method) {
        case `get`:
            return input.request_body.Get;
        case `get-zone-records`:
            return input.request_body.GetZoneRecords;
        case `set`:
            return input.request_body.Set;
        case `search`:
            return input.request_body.Search;
        case `delete`:
            return input.request_body.Delete;
    }
};

export const allowDomains = (input: Input, output: Output, domainsToAllow: string[]) => {
    if (input.api_method === `get` || input.api_method === `set` || input.api_method === `delete`) {
        const body = getBodyForApiMethod(input);

        /*@ts-ignore*/
        const allRecordsValid = body.records.every((record) => {
            return domainsToAllow.some((d) => {
                return record.name.endsWith(d);
            });
        });

        if (allRecordsValid) {
            allow(output);
        } else {
            deny(output, `Name not allowed`);
        }
    } else if (input.api_method === `get-zone-records`) {
        const allRecordsValid = input.request_body.GetZoneRecords.names.every((name) => {
            return domainsToAllow.some((d) => {
                return name === d;
            });
        });

        if (allRecordsValid) {
            allow(output);
        } else {
            deny(output, `Name not allowed`);
        }
    } else if (input.api_method === `search`) {
        const allRecordsValid = input.request_body.Search.globs.every((record) => {
            return domainsToAllow.some((d) => {
                return record.name_glob.endsWith(d);
            });
        });

        if (allRecordsValid) {
            allow(output);
        } else {
            deny(output, `Name not allowed`);
        }
    } else if (input.api_method === `health`) {
        allow(output);
    }
};
