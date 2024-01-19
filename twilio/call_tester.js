const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config("./.env");

const url = `https://${process.env.NGROK_URL}/call`;
const data = {
    phone_number: process.env.TO_NUMBER, // '5087949928', +12107752763, 13308798656, +15015661755, +12107752763, 14155139960
    // objective: 'Order a pizza for me.',
    // objective: 'give me a brief introduction about python and AI in 2 sentences.',
    // v: '0'
};
const headers = {
    'Content-Type': 'application/json',
};

axios.post(url, data, { headers })
    .then(response => {
        console.log(response.data);
    })
    .catch(error => {
        console.error(error);
    });