import { ApiRecord, RecordIdentifier } from "../types.js";

export enum RequestType {
    Get = `get`,
    GetZone = `get-zone`,
    Delete = `delete`,
    Set = `set`,
    Search = `search`,
    Health = `health`,
}

export interface BaseInput {
    readonly ip: string;
    readonly utc_millis: number;
    readonly user_agent: string;
}

export interface GetInput extends BaseInput {
    readonly api_method: RequestType.Get;
    readonly request_body: {
        Get: {
            records: RecordIdentifier[];
        };
    };
}

export interface GetZoneInput extends BaseInput {
    readonly api_method: RequestType.GetZone;
    readonly request_body: {
        GetZone: {
            names: string[];
        };
    };
}

export interface SetInput extends BaseInput {
    readonly api_method: RequestType.Set;
    readonly request_body: {
        Set: {
            records: ApiRecord[];
        };
    };
}

export interface DeleteInput extends BaseInput {
    readonly api_method: RequestType.Delete;
    readonly request_body: {
        Delete: {
            records: RecordIdentifier[];
        };
    };
}

export interface SearchInput extends BaseInput {
    readonly api_method: RequestType.Search;
    readonly request_body: {
        Search: {
            records: RecordIdentifier;
        };
    };
}

export interface HealthInput extends BaseInput {
    readonly api_method: RequestType.Health;
    readonly request_body: {
        Health: {};
    };
}
