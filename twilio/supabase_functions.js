const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const insert_call = async (call_sid, phone_to, params, apiKey, messages) => {
    const { data, error } = await supabase.from("belva").insert({
        call_sid,
        call_to: phone_to,
        parameters: params,
        'api_key': apiKey,
        agent_messages: messages
    }).select()
    if (error) {
        console.log(error)
        return null
    } else {
        console.log("Call object", data[0]?.call_id)
        return data[0]?.call_id
    }

}

const get_call_param = async (call_id) => {
    const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .eq('call_id', call_id);

    if (promptError) {
        console.log('Error: ', promptError);
    } else {
        return promptData[0]
    }
}


const update_call_sid = async (call_sid, call_id) => {
    const { data, error } = await supabase.from("belva").update({
        call_sid,
    }).eq("call_id", call_id).select()
    if (error) {
        console.log("Call udpate", error)
        return null
    } else {
        console.log("Call object", data[0]?.call_id)
        return data[0]?.call_id
    }

}

const update_agent_message = async (messages, call_id) => {
    const { data, error } = await supabase.from("prompts").update({
        messages,
    }).eq("call_id", call_id).select()
    if (error) {
        console.log("Message udpate", error)
        return null
    } else {
        console.log(call_id);
        console.log(messages);
        console.log("Message object", data[0]?.call_id)
        return data[0]?.call_id
    }

}
const transcript_byte = async (call_id, said_by, text) => {
    const { data, error } = await supabase.from("transcripts").insert({
        call_id,
        said_by,
        text
    }).select()
    if (error) {
        console.log("transcript insert", error)
        return null
    } else {

        return true
    }

}

const check_api_key = async (apiKey) => {
    const { data, error } = await supabase
        .from("api_keys")
        .select("apiKey")
        .eq("apiKey", apiKey);

    if (error) {
        console.error("Error fetching api_key", error);
        return false;
    } else {
        // If the data array has a length greater than 0, it means the key exists
        return data.length > 0;
    }
}


async function getTranscripts(apiKey, call_id) {
    let { data: apiKeys, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('apiKey', apiKey)

    if (apiKeyError) {
        console.log('Error: ', apiKeyError)
        return
    }

    // Fetch the related call_id from belva table
    let { data: belvaData, error: belvaError } = await supabase
        .from('belva')
        .select('call_id, call_to, parameters, is_done') // Selecting only the required fields
        .eq('api_key', apiKeys[0].apiKey)
        .eq('call_id', call_id)

    if (belvaError) {
        console.log('Error: ', belvaError)
        return
    }

    // Fetch the transcripts
    let { data: transcripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', belvaData[0].call_id)
        .order('created_at', { ascending: true }) // order by created_at to ensure correct calculation of call length

    if (transcriptsError) {
        console.log('Error: ', transcriptsError)
        return
    }

    // Calculate call length if is_done is true
    let call_length = undefined;
    if (belvaData[0].is_done && transcripts.length > 0) {
        const start = transcripts[0].created_at;
        const end = transcripts[transcripts.length - 1].created_at;
        call_length = (new Date(end) - new Date(start)) / 1000; // Call length in seconds
    } else {
        call_length = undefined;
    }

    // Format the response to include transcripts as an array in the object
    let response = {
        ...belvaData[0],
        transcripts: transcripts,
        call_length: call_length ? call_length : null
    }

    return response;
}
async function updateIsDone(call_id, isDoneValue) {
    console.log("ENDING CALL WITH IS DONE ")
    // Fetch the related call_id from belva table
    let { data: belvaData, error: belvaError } = await supabase
        .from('belva')
        .select('call_id, api_key, is_done') // Added is_integration
        .eq('call_id', call_id)

    if (belvaError) {
        console.log('Error: ', belvaError)
        return
    }

    // If is_integration is true, do not bill the user
    if (belvaData[0]) {
        console.log("Making done.")
        // update the is_done status and return
        let { data: updatedRows, error: updateError } = await supabase
            .from('belva')
            .update({ is_done: isDoneValue })
            .eq('call_id', call_id)

        if (updateError) {
            console.log('Error: ', updateError)
            return
        }

        return updatedRows;
    }

    // Continue with the rest of the function if is_integration is false...

    // Fetch the transcripts
    let { data: transcripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', belvaData[0].call_id)
        .order('created_at', { ascending: true }) // order by created_at to ensure correct calculation of call length

    if (transcriptsError) {
        console.log('Error: ', transcriptsError)
        return
    }

    let call_length = undefined;
    if (transcripts.length > 0) {
        const start = transcripts[0].created_at;
        const end = transcripts[transcripts.length - 1].created_at;
        call_length = Math.ceil((new Date(end) - new Date(start)) / 60000); // Call length in minutes
    } else {
        call_length = 0;
    }

    // get the api_key's user id to deduct credits
    let { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('user_id')
        .eq('apiKey', belvaData[0].api_key);

    if (apiKeyError || apiKeyData[0]?.integration_key) {
        console.log('Error: ', apiKeyError)
        return
    }

    let userId = apiKeyData[0].user_id;

    // get the user's current credit balance
    let { data: creditData, error: creditError } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', userId);

    if (creditError) {
        console.log('Error: ', creditError)
        return
    }

    let currentBalance = creditData[0].balance;

    let newBalance = currentBalance - call_length;
    // check if there's enough balance to deduct
    if (currentBalance < call_length) {
        newBalance = 0
    }

    // update the credit balance
    let { data: updatedCredit, error: creditUpdateError } = await supabase
        .from('credits')
        .update({ balance: newBalance })
        .eq('user_id', userId);

    if (creditUpdateError) {
        console.log('Error: ', creditUpdateError)
        return
    }

    // finally, update the is_done status
    let { data: updatedRows, error: updateError } = await supabase
        .from('belva')
        .update({ is_done: isDoneValue })
        .eq('call_id', call_id)

    if (updateError) {
        console.log('Error: ', updateError)
        return
    }

    return updatedRows;
}


// Use the function:


module.exports = { insert_call, update_call_sid, transcript_byte, check_api_key, getTranscripts, updateIsDone, get_call_param, update_agent_message}