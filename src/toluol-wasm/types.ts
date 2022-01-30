export interface ToluolResponse {
    additional_answers: ToluolAnswer[];
    answers: ToluolAnswer[];
    authoritative_answers: ToluolAnswer[];
    header: ToluolHeader;
    questions: ToluolQuestion[];
}

export interface ToluolAnswer {
    NONOPT: {
        atype: string;
        class: `IN`;
        name: string;
        rdata: string[];
        ttl: number;
    };
}

export interface ToluolQuestion {
    qclass: string;
    qname: string;
    qtype: string;
}
export interface ToluolHeader {
    ancount: number;
    arcount: number;
    flags: { flags: number };
    msg_id: number;
    nscount: number;
    opcode: string;
    qdcount: number;
    qr: boolean;
    rcode: string;
}

export interface ToluolModule {
    init_panic_hook: Function;
    new_query: Function;
    parse_answer: Function;
}
