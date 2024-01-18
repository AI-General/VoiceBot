async function log(msg, ...args) {
    console.log(new Date().toISOString(), msg, ...args);
}

module.exports = { log }