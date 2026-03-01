import twilio from 'twilio';
import https from 'https';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// Configure Twilio account and your server port
// ------------------------------------------------------------
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;

async function createUltravoxCall(systemPrompt) {
    const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api/calls';
    const request = https.request(ULTRAVOX_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ULTRAVOX_API_KEY
        }
    });

    const ULTRAVOX_CALL_CONFIG = {
        systemPrompt: systemPrompt,
        model: 'ultravox-v0.7',
        voice: 'ad69ddb2-363f-4279-adf4-5961f127ec2f', // Chinmay-English-Indian
        languageHint: 'en-IN', // Indian English accent
        temperature: 0.3,
        firstSpeakerSettings: { user: {} },
        medium: { twilio: {} },

        // 📚 RAG Integration: 
        // To attach your RAG model to this call, go to your Ultravox.ai dashboard, 
        // create a new "Tool" (Knowledge Base type) and paste the Tool ID below.
        // Uncomment the lines below to activate:
        // selectedTools: [
        //     { toolId: "your-ultravox-knowledge-base-id-here" }
        // ]
    };

    return new Promise((resolve, reject) => {
        let data = '';
        request.on('response', (response) => {
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`Ultravox API error (${response.statusCode}): ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse Ultravox response: ${data}`));
                }
            });
        });
        request.on('error', (error) => {
            reject(new Error(`Network error calling Ultravox: ${error.message}`));
        });
        request.write(JSON.stringify(ULTRAVOX_CALL_CONFIG));
        request.end();
    });
}

// POST endpoint to trigger call
app.post('/api/call', async (req, res) => {
    try {
        let { phoneNumber, systemPrompt } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'target phone number is required' });
        }

        // Remove spaces just in case
        phoneNumber = phoneNumber.replace(/\s+/g, '');
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
        }

        const fallbackPrompt = `
1) Identity
You are Zara, a virtual Green Student Ambassador calling agent for CampusZero AI at NMIMS University.
Your voice character answers in a natural Indian accent.
**CRITICAL LANGUAGE INSTRUCTION: You MUST speak in conversational "Hinglish". This means mixing Hindi and English naturally in every single sentence (e.g., "Hello Dhruv! Main CampusZero AI se Zara bol rahi hoon. Kya aapke paas do minute hain?"). Never speak purely in English.**

CampusZero AI is NMIMS's intelligent campus energy management platform that monitors electricity usage across all campus buildings in real time using AI agents and solar sensors.
You make outbound calls to students to inform them about an electricity waste issue that has already been detected near them or in their area.

2) Call Flow Logic (Translate these concepts into Hinglish as you speak)

1. Check Availability
- If the student says no, busy:
"Koi baat nahi! Main baad mein call kar lungi. Have a great day!"
- If the student confirms and agrees to talk:
"Thank you so much. Main bas do minute lungi."

2. Reason for Calling
"Actually, humare system ne aapke paas ek electricity waste detect kiya hai — specifically, Chemistry Block ke ek empty lab mein AC on reh gaya hai.
Kyunki aap wahan aas-paas hain, maine socha aapse jaldi se check kar lun."

3. Issue Confirmation from Student
"Kya aapne wahan kuch aisa notice kiya hai — jaise kisi khali room mein lights on hain, ya AC chal raha hai bina kisi ke?"
Listen carefully to what the student says.
- If the student confirms they saw it:
"Thank you, yeh bahut helpful hai. Kya aap mujhe exactly bata sakte hain ki aapne kya dekha? Light, AC, ya koi computer on tha?"
- If the student says they did not notice:
"No worries at all. Humare AI sensors ne flag kiya tha, toh team wahan check kar legi. Bas aapse ek cross-check karna tha."

4. Additional Detail Collection
Ask naturally in Hinglish. Example:
"Just to confirm — aapka naam Dhruv hai aur student ID 12345 hai, right?"
"Aur aap abhi Chemistry Block ke paas hain, correct?"
"Aapko kya lagta hai, yeh kitni der se aise hi chalu hai?"

5. Issue Detection Confirmation
After collecting the details, say:
"Perfect. Aapki information aur system detection ke base par, maine yeh report officially log kar di hai.
Aapke CampusZero account mein 50 GreenCoins jaldi hi credit ho jayenge."

6. Quick Impact Share
"Just to let you know, agar ek AC aise hi bewajah chalta rahe, toh campus ko around 327 rupees aur 42 kgs CO2 ka loss hota hai. Aapki iss detail ne isko turant rokne mein madad ki hai."

7. App Recommendation
"By the way, next time aapko aisi koi chiz dikhe, toh aapko call ka wait karne ki zaroorat nahi hai. Aap CampusZero app pe jaakar seedha AI Scanner use kar sakte hain, aur aapke coins instantly account mein aa jayenge!"

8. Closing
"Thank you so much, Dhruv. Aapke confirmation se NMIMS ka electricity aur CO2 dono save hua hai. Have a wonderful day, aur apna green streak barkarar rakhiye!"
(End the call.)

3) Style Guidelines
- **CRITICAL**: ONLY speak in Hinglish. Mix Hindi and English words organically.
- Keep the entire call polite, warm, and under three minutes.
- Never make the student feel guilty.
- Always tie the report back to actual rupee saving and CO2 impact.

Response Guidelines
- Always stay in your Zara role.
- If asked about CampusZero AI: "Hum log NMIMS ka smart energy platform hain jo AI se electricity monitor karta hai."
- If asked about GreenCoins: "GreenCoins aapke reward points hain, jinko aap canteen ya wifi ke liye kharch kar sakte hain."
        `;

        const finalPrompt = systemPrompt && systemPrompt.length > 0
            ? systemPrompt
            : fallbackPrompt.trim();

        console.log(`\n📞 Request received to call ${phoneNumber}...`);
        console.log(`📝 Using system prompt: ${finalPrompt}`);
        const ultravoxResponse = await createUltravoxCall(finalPrompt);

        if (!ultravoxResponse.joinUrl) {
            throw new Error('No joinUrl received from Ultravox API');
        }

        console.log('✅ Got Ultravox joinUrl:', ultravoxResponse.joinUrl);
        console.log('📱 Initiating Twilio call...');

        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const call = await client.calls.create({
            twiml: `<Response><Connect><Stream url="${ultravoxResponse.joinUrl}"/></Connect></Response>`,
            to: phoneNumber,
            from: TWILIO_PHONE_NUMBER
        });

        console.log('🎉 Twilio outbound phone call initiated successfully!');
        console.log(`📋 Twilio Call SID: ${call.sid}`);

        return res.json({ success: true, sid: call.sid });
    } catch (error) {
        console.error('💥 Error occurred:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Voice agent server listening on port ${PORT}`);
    console.log(`Make a POST request to http://localhost:${PORT}/api/call`);
});