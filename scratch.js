// just for testing

const bcrypt = require("bcrypt");

async function hashPlease() {
    let masterPassword = "admin123";
    const hashedPass = await bcrypt.hash(masterPassword, 10);
    return hashedPass;
}

(async () => {
    try {
        const hashedPassword = await hashPlease();
        console.log(hashedPassword);
    } catch (error) {
        console.error("Error:", error);
    }
})();
