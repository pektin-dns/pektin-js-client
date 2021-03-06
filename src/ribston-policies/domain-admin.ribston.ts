import { Input, Output } from "./ribston-types.js";
import { allowDomains } from "./utils.js";

/*
POLICY INFORMATION
{
    "version": "1.0.0",
    "use":"pektin-dns",
    "name": "domain-admin",
    "class": "domain-admin",
    "contact": "pektin@y.gy"
}
*/
const input: Input = {} as Input;
const output: Output = {
    status: `UNDECIDED`,
    message: `Policy didn't reach a decission`,
};

/* Your code goes beneath this */
const domains: string[] = [];
allowDomains(input, output, domains);
