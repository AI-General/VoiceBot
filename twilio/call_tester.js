const axios = require('axios');


const url = 'https://3efc-34-29-145-103.ngrok-free.app/call';
const data = {
    phone_number: '14155139960', // '5087949928', +12107752763, 13308798656, +15015661755, +12107752763, 14155139960
    objective: 'Order a pizza for me.',
    // objective: 'give me a brief introduction about python and AI in 2 sentences.',
    v: '0'
};
const headers = {
    'Content-Type': 'application/json',
    // 'x-api-key': 'cb-xyz42069',
};

axios.post(url, data, { headers })
    .then(response => {
        console.log(response.data);
    })
    .catch(error => {
        console.error(error);
    });