import { cwd } from "process";

export enum LogCategory {
    DebugExcessive,
    Debug,
    Warning,
    Error,
    Notice,
}
export interface Log {
    message: string;
    category?: LogCategory;
    stack: string[] | undefined;
}
export interface CallNames {
    [functionName: string]: { name: string };
}

export class Logg {
    categories: LogCategory[];
    logs: Log[];
    callNames?: CallNames;
    constructor(logg: { categories: LogCategory[]; callNames?: CallNames }) {
        this.categories = logg.categories;
        this.logs = [];
        this.callNames = logg.callNames;
        this.attach();
    }
    // inserts a log
    l = (message: string, category: LogCategory = 0) => {
        this.logs.push({ message, category, stack: this.getStack(2) });
    };
    getStack = (shift: number = 1) => {
        let s = new Error().stack;
        if (!s) return;
        s = s.replace(`Error\n`, ``);
        let sp = s.split(`\n`).map((ss) => ss.replace(`    at `, ``));
        sp = sp.slice(shift);
        if (!sp?.length) return;
        sp = sp.map((spp) => {
            return spp.indexOf(`(`) !== -1
                ? spp.substring(0, spp.indexOf(`(`) - 1)
                : spp.replace(`file://`, ``).replace(cwd(), ``).substring(1);
        });
        sp.reverse();
        return sp;
    };
    displayLogs = () => {
        console.log(this.logs.map(this.beautifyLog));
    };
    beautifyLog = (log: Log) => {
        return `${this.beautifyStack(log.stack)}: ${log.message}`;
    };
    beautifyStack = (stack: string[] | undefined) => {
        if (!stack) return ``;
        let s = ``;
        if (this.callNames) {
            stack = stack.map((se) => {
                if (!this.callNames || !this.callNames[se]) return se;

                return se.replace(se, this.callNames[se].name);
            });
        }
        stack.forEach((se, i) => (s += `${i > 0 ? ` > ` : ``}${se}`));
        return s;
    };
    attach = () => {
        /*@ts-ignore*/
        global.l = this;
    };
}
