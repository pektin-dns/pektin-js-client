import { ExtendedPektinApiClient } from "../index.js";
const pc = new ExtendedPektinApiClient({
    username: "admin-8V5adk-TuQKIEw",
    managerPassword:
        "m.i-NBaFlt9JSIqEeN56gWWo_iLltOQHrc8aYLNOnalfKu00hoB202vCiS7Bc2-0hac3-lfnAs7Av-vG-gpZiGDMaBk3MthYqPC1TRt4TePC5nSTRvp0P38sr3yprZR0cs5obElA",
    confidantPassword:
        "c.hrWFuu3EH-MdmgzAUa0hsFWisdzV4zORSQwzZIqNv6kGgBEvzB0-qcursvuHNmOZQ9TRfsOpTy-OQflKJ0H3i39uAOFb7RjfW9im1NImgzfM9ICV0gAGFhXY6ZQb86YCujg3Bg",
    vaultEndpoint: "http://127.0.0.1:8200"
});

console.log(
    await pc.getZoneRecords(["cloudflare.com", "pektin.xyz.", "pektin.xyzss.", "dadsd.com"])
);
