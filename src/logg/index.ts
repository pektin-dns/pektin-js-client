import { cwd } from "process";
import { promises as fs } from "fs";
import path from "path";
import c from "chalk";

export enum LogCategory {
    DebugExcessive,
    Debug,
    Warning,
    Error,
    Info,
}
export interface Log {
    message: string;
    category: LogCategory;
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
    log = (message: string, category: LogCategory = 0, display = true) => {
        this.logs.push({ message, category, stack: this.getStack(2) });
        if (display) this.displayLast();
    };
    getStack = (shift: number = 1) => {
        let s = new Error().stack;
        if (!s) return;
        s = s.replace(`Error\n`, ``);
        let sp = s.split(`\n`).map((ss) => ss.replace(`    at `, ``));
        sp = sp.slice(shift);
        if (!sp?.length) return;
        sp = sp.map((spp) => {
            spp = spp.replace(`async `, ``);
            return spp.indexOf(`(`) !== -1
                ? spp.substring(0, spp.indexOf(`(`) - 1)
                : `./` + spp.replace(`file://`, ``).replace(cwd(), ``).substring(1);
        });
        sp = sp.filter((sp) => !sp.includes(`processTicksAndRejections`));
        sp.reverse();
        return sp;
    };
    displayLogs = () => {
        console.log(this.logs.map(this.beautifyLog));
    };
    displayLast = () => {
        console.log(this.beautifyLog(this.logs[this.logs.length - 1]));
    };

    displayLastMarkdown = async () => {
        await fs.writeFile(
            `${path.join(cwd(), `logs.md`)}`,
            this.beautifyMarkdown(this.logs[this.logs.length - 1])
        );
    };
    beautifyMarkdown = (log: Log) => {
        return `## ${this.beautifyStack(log.stack)}\n    ${log.message}\n`;
    };
    beautifyLog = (log: Log) => {
        if (log.stack) this.collapseStack(log.stack);
        return `${this.getCategory(log.category)}\n  ${this.beautifyStack(log.stack)}\n    ${
            log.message
        }`;
    };
    getCategory = (category: LogCategory) => {
        switch (category) {
            case LogCategory.Error:
                return c.bold.red(`ERROR`);
            case LogCategory.Warning:
                return c.bold.yellow(`WARN`);

            default:
                break;
        }
    };
    collapseStack = (stack: string[]) => {
        const a: [string, number][] = [];
        for (let i = 0; i < stack.length; i++) {
            const s = stack[i];
            if (i > 0 && a[a.length - 1][0] === s[i]) {
                a[a.length - 1] = [s, a[a.length - 1][1] + 1];
            } else {
                a.push([s, 1]);
            }
        }
        console.log(a);
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
