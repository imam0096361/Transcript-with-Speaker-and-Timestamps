
import { GoogleGenAI, Type } from "@google/genai";
import { fileToBase64 } from "../utils/file";

// Match types from App.tsx
type OutputFormat = 'journalistic-english' | 'journalistic-bangla' | 'interview' | 'roundtable' | 'academic' | 'simple' | 'detailed' | 'json' | 'text' | 'markdown' | 'srt';
type InputLanguage = 'english' | 'bangla' | 'both';

// Match types from GlossaryManager.tsx
interface GlossaryTerm {
    term: string;
    definition: string;
}

// Use import.meta.env for Vite - this is the correct way to access env vars in Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
console.log('VITE_GEMINI_API_KEY exists:', !!apiKey);

if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured. Please check your .env.local file.');
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Parses a Gemini API error and returns a user-friendly error object.
 * @param error The unknown error caught from the API call.
 * @returns An Error object with a user-friendly message.
 */
const handleGeminiError = (error: unknown): Error => {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        console.error("Gemini API Error:", error); // Log the original error for debugging

        if (message.includes('api key not valid') || message.includes('api_key_invalid')) {
            return new Error("Invalid API Key. Please ensure it is configured correctly.");
        }
        if (message.includes('quota') || message.includes('rate limit')) {
            return new Error("API rate limit or quota exceeded. Please check your usage or try again later.");
        }
        if (message.includes('invalid argument') || message.includes('malformed')) {
            return new Error("The request was invalid, which could be due to a corrupted audio file. Please try a different file.");
        }
        if (message.includes('resource_exhausted')) {
            return new Error("The audio file may be too long or the request too complex. Please try with a shorter audio file.");
        }
        if (message.includes('permission_denied')) {
             return new Error("API permission denied. Please check if the API is enabled in your Google Cloud project.");
        }
        if (message.includes('internal') || message.includes('server error') || message.includes('500') || message.includes('503')) {
             return new Error("The AI model encountered an internal error. Please try again in a few moments.");
        }
        
        // Fallback for other specific but uncaught errors
        return new Error(`An AI service error occurred: ${error.message}`);
    }
    // Fallback for non-Error objects
    return new Error("An unknown error occurred while communicating with the AI service.");
};

export const translateText = async (
    textToTranslate: string,
    targetLanguage: string
): Promise<string> => {
    try {
        const prompt = `Translate the following text into high-quality, professional ${targetLanguage}.
        
CRITICAL INSTRUCTION: You MUST preserve the original formatting of the text. This includes:
- Paragraph breaks and line spacing.
- Speaker labels (e.g., "Speaker A:", "Interviewer:"). Do NOT translate the labels themselves.
- Timestamps (e.g., [HH:MM:SS]).
- Markdown syntax (headings, bold, lists, etc.).
- JSON structure if the input is JSON.

Provide ONLY the translated text, without any additional comments or explanations.

Text to Translate:
---
${textToTranslate}
---
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });

        return response.text;

    } catch (error) {
        throw handleGeminiError(error);
    }
};

export const proofreadTranscript = async (transcript: string): Promise<string[]> => {
    if (!transcript.trim()) {
        return [];
    }

    try {
        const proofreadSchema = {
            type: Type.OBJECT,
            properties: {
                errors: {
                    type: Type.ARRAY,
                    description: "An array of strings. Each string must be the EXACT, verbatim sentence from the transcript that is identified as being incomplete, grammatically incorrect, or nonsensical due to a potential transcription error.",
                    items: {
                        type: Type.STRING,
                    },
                },
            },
            required: ['errors'],
        };

        const prompt = `You are an expert proofreader. Your task is to analyze the following raw audio transcript and identify sentences that are likely incorrect due to transcription errors. Look for sentences that are:
- Grammatically incorrect or nonsensical.
- Abruptly cut off or incomplete.
- Contextually out of place.

Analyze the entire transcript provided below. Then, return a JSON object containing a list of the identified sentences. The sentences in your response MUST be an exact match to the sentences in the original transcript.

Raw Transcript:
---
${transcript}
---
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: proofreadSchema,
            }
        });

        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.errors || [];

    } catch (error) {
        console.error("Proofreading API call failed:", error);
        // In case of error, just return an empty array and don't block the user.
        return [];
    }
};

export const transcribeAudioChunk = async (
  file: Blob,
  language: InputLanguage,
  withSpeakerLabels: boolean,
  glossary: GlossaryTerm[]
): Promise<string> => {
    try {
        const audioFile = new File([file], "audio_chunk.wav", { type: 'audio/wav' });
        const base64Audio = await fileToBase64(audioFile);

        const audioPart = {
            inlineData: {
                data: base64Audio,
                mimeType: audioFile.type,
            },
        };

        let prompt = "Your primary task is to transcribe the entire provided audio file from start to finish without omitting any part. Be thorough and precise.\n\n";
        
        if (language === 'english') {
            prompt += "The language is exclusively English. You MUST use the Latin script. Do not transcribe into any other language or script."
        } else if (language === 'bangla') {
            prompt += "The language is exclusively Bengali (Bangla). You MUST use the Bengali script. Do not transcribe into any other language or script."
        } else if (language === 'both') {
            prompt += "You are an expert multilingual transcription AI. Transcribe the audio VERBATIM. It contains a mix of English and Bengali (Bangla).\n- When you hear Bengali, you MUST transcribe it using the Bengali script (e.g., 'বাংলা').\n- When you hear English, transcribe it using the Latin script.\n- DO NOT translate between languages.\n- DO NOT transliterate Bengali into English letters (no 'Banglish').\n- Capture the speech exactly as it is spoken, preserving the original language of each word and sentence.";
        }
        
        if (withSpeakerLabels) {
            prompt += "\n\n**Speaker Identification:**\nYou MUST identify different speakers and label them consistently with generic labels like 'Speaker A:', 'Speaker B:', etc. Prepend the label to each speaker's turn.";
        }
        
        if (glossary && glossary.length > 0) {
            const glossaryItems = glossary.map(g => `- Term: "${g.term}", Use: "${g.definition}"`).join('\n');
            prompt += `\n\n**Custom Glossary (CRITICAL):**\nYou MUST strictly adhere to the following custom glossary for accuracy and consistency:\n${glossaryItems}`;
        }

        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [audioPart, textPart] }
        });
        
        return response.text;

    } catch (error) {
        throw handleGeminiError(error);
    }
};

export const transcribeAudioFile = async (
  file: File,
  language: InputLanguage,
  withTimestamps: boolean,
  withSpeakerLabels: boolean,
  glossary: GlossaryTerm[],
  onChunk: (chunk: string) => void
): Promise<void> => {
    try {
        const base64Audio = await fileToBase64(file);
        const audioPart = {
            inlineData: {
                data: base64Audio,
                mimeType: file.type,
            },
        };

        let prompt = "Your primary task is to transcribe the entire provided audio file from start to finish without omitting any part. Be thorough and precise.\n\n";
        
        if (language === 'english') {
            prompt += "The language is exclusively English. You MUST use the Latin script. Do not transcribe into any other language or script."
        } else if (language === 'bangla') {
            prompt += "The language is exclusively Bengali (Bangla). You MUST use the Bengali script. Do not transcribe into any other language or script."
        } else if (language === 'both') {
            prompt += "You are an expert multilingual transcription AI. Transcribe the audio VERBATIM. It contains a mix of English and Bengali (Bangla).\n- When you hear Bengali, you MUST transcribe it using the Bengali script (e.g., 'বাংলা').\n- When you hear English, transcribe it using the Latin script.\n- DO NOT translate between languages.\n- DO NOT transliterate Bengali into English letters (no 'Banglish').\n- Capture the speech exactly as it is spoken, preserving the original language of each word and sentence.";
        }
        
        if (withSpeakerLabels) {
            prompt += "\n\n**Speaker Identification:**\nYou MUST identify different speakers and label them consistently with generic labels like 'Speaker A:', 'Speaker B:', etc. Prepend the label to each speaker's turn.";
        }

        if (withTimestamps && language === 'both') {
            prompt += "\n\n**Timestamp Generation:**\nYou MUST add inferred timestamp markers in the format [HH:MM:SS] at the beginning of each speaker's turn or significant phrase. The timestamps must accurately reflect the elapsed time within the audio file, starting from [00:00:00]. Infer the timing with high precision, basing it on conversational rhythm, sentence length, and natural pauses. Timestamps must be sequential and cover the full duration of the transcribed content.";
        }
        
        if (glossary && glossary.length > 0) {
            const glossaryItems = glossary.map(g => `- Term: "${g.term}", Use: "${g.definition}"`).join('\n');
            prompt += `\n\n**Custom Glossary (CRITICAL):**\nYou MUST strictly adhere to the following custom glossary for accuracy and consistency:\n${glossaryItems}`;
        }


        const textPart = { text: prompt };

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-pro',
            contents: { parts: [audioPart, textPart] }
        });
        
        for await (const chunk of responseStream) {
            if (chunk.text) {
                onChunk(chunk.text);
            }
        }
    } catch (error) {
        throw handleGeminiError(error);
    }
};

export const formatTranscript = async (
    transcript: string, 
    format: OutputFormat, 
    language: InputLanguage, 
    withTimestamps: boolean,
    withSpeakerLabels: boolean,
    glossary: GlossaryTerm[]
): Promise<string> => {
    try {
        const languageHint = {
            english: 'The interview is in English.',
            bangla: 'The interview is in Bengali (Bangla).',
            both: 'The interview contains a mix of English and Bengali (Bangla).'
        }[language];
        
        const hasRawTimestamps = /\[\d{2}:\d{2}:\d{2}\]/.test(transcript);

        let formatInstruction: string;
        
        const baseJournalisticPrompt = 'Your primary goal is to create a compelling narrative flow. Synthesize the conversation, remove conversational fillers (ums, ahs, repetitions), correct grammar, and ensure smooth readability. The output should read like a well-written news story or feature, not a simple transcription.';

        switch(format) {
            case 'journalistic-english':
                formatInstruction = `You are an editor for "The Daily Star", a major English-language newspaper. Your task is to perform a two-step process:\n1. **Translate**: First, ensure the entire text is in high-quality, professional, journalistic English. If the source text is in another language or mixed, translate it accurately.\n2. **Format**: Then, format the English text as a clean, paragraph-based journalistic article suitable for publication in "The Daily Star". ${baseJournalisticPrompt}`;
                break;
            case 'journalistic-bangla':
                formatInstruction = `You are an editor for "The Daily Star Bangla", a major Bengali-language newspaper. Your task is to perform a two-step process:\n1. **Translate**: First, translate the entire text into high-quality, professional, journalistic Bengali (Bangla). You MUST use the Bengali script.\n2. **Format**: Then, format the Bengali text as a clean, paragraph-based journalistic article suitable for publication in "The Daily Star Bangla". ${baseJournalisticPrompt}`;
                break;
            case 'interview':
                formatInstruction = 'Format as a Q&A style interview. Clearly label speakers (e.g., Interviewer:, Speaker 1:). If speaker names are not clear, use generic labels. Keep the questions and answers distinct.';
                break;
            case 'roundtable':
                formatInstruction = 'Format as a roundtable discussion. Identify and label multiple speakers. Capture the flow of conversation and interjections. Use speaker labels consistently.';
                break;
            case 'academic':
                formatInstruction = 'Format for academic research or publication. Use formal language and a clear, logical structure. Ensure verbatim accuracy but clean up false starts and minor stutters. Go beyond a simple transcription by analyzing the context to infer structure, identify key themes, and highlight salient points or arguments made by the speakers. If appropriate, structure the text with thematic headings.';
                break;
            case 'simple':
                formatInstruction = 'Format as a "Simple Transcript". This means creating a clean, paragraph-based output with minimal editing. Correct obvious grammatical errors and remove conversational fillers (ums, ahs) to improve readability, but do not rephrase sentences or change the speaker\'s original meaning. The goal is a highly readable, clean version of the raw transcript.';
                break;
            case 'detailed':
                formatInstruction = 'Format as a "Detailed Transcript". This is a strict, verbatim-style format. You MUST identify and label each speaker (e.g., Speaker A:, Speaker B:). Crucially, you MUST also add an inferred timestamp in the [HH:MM:SS] format at the beginning of EVERY sentence or distinct conversational turn. When inferring timestamps, your primary goal is contextual accuracy. Analyze the conversational rhythm, sentence structure, and natural pauses in the raw transcript. A short, quick sentence should have a smaller time gap from the previous one than a long, complex sentence followed by a pause. The timestamps MUST reflect a plausible and realistic progression of a real conversation, not just evenly spaced intervals. Precision is key.';
                break;
            case 'json':
                formatInstruction = "Format the transcript into a structured JSON object. The JSON must have a main key 'transcript' which is an array of objects. Each object must have 'speaker' and 'dialogue' keys. Perform robust speaker identification. If specific names are not mentioned, you MUST use generic, consistent labels like 'Speaker A', 'Speaker B', 'Speaker C', etc., for each distinct speaker throughout the conversation.";
                break;
            case 'text':
                formatInstruction = 'Format as plain text. Clean up the transcript by removing filler words (ums, ahs), correcting obvious typos, and structuring it into clear paragraphs. Do not add any special formatting like speaker labels unless necessary for clarity.';
                break;
            case 'markdown':
                formatInstruction = 'Format the transcript in Markdown. Use headings for speakers or sections, bold for emphasis, and lists for key points if applicable. Ensure it is well-structured and readable.';
                break;
            case 'srt':
                formatInstruction = `You are an expert in creating subtitle files. Your task is to convert the raw audio transcript into the SubRip Text (.srt) format.
Follow these rules strictly:
1.  Each entry must have a sequential number (1, 2, 3...).
2.  Followed by a start and end timestamp in the format HH:MM:SS,ms --> HH:MM:SS,ms. Notice the comma for milliseconds.
3.  Followed by the subtitle text on one or more lines for readability.
4.  Separate each entry with a blank line.

Timestamp Inference Logic:
- The raw transcript may contain timestamps like [HH:MM:SS]. Use these as the START time for a subtitle block.
- Infer the END time based on the length of the text and natural pauses.
- If no timestamps are present, infer both start and end times by analyzing conversational rhythm. A subtitle block should represent a complete sentence or clause.
- Ensure timestamps are sequential and do not overlap.
- Clean the subtitle text by removing fillers (ums, ahs) but preserve the original meaning.`;
                break;
        }


        const relevantFormatsForSpeakerLabels = ['journalistic-english', 'journalistic-bangla', 'academic', 'simple', 'text', 'markdown'];
        if (withSpeakerLabels && relevantFormatsForSpeakerLabels.includes(format)) {
            formatInstruction += "\nIMPORTANT (Speaker Labels): You must identify and label distinct speakers. Prepend each piece of dialogue with a label like 'Speaker A:', 'Speaker B:', etc. Be consistent with the labels for each speaker throughout the entire conversation.";
        }

        const relevantFormatsForTimestamps = ['journalistic-english', 'journalistic-bangla', 'academic', 'markdown', 'simple', 'detailed'];
        if (withTimestamps && relevantFormatsForTimestamps.includes(format)) {
            if (hasRawTimestamps) {
                 formatInstruction += "\nIMPORTANT (Timestamps): The raw transcript contains timestamps in the [HH:MM:SS] format. You MUST preserve and correctly place these existing timestamps in the formatted output. Do not create new timestamps; use the ones provided.";
            } else {
                 formatInstruction += "\nIMPORTANT (Timestamps): You must also add inferred timestamp markers in the format [HH:MM:SS] at the beginning of sentences or where significant pauses would naturally occur. The timestamps should be sequential and reflect a plausible progression of time throughout the conversation. Infer the timing with high precision, basing it on sentence length and natural conversational breaks. A short sentence followed immediately by another should have a small time gap. A longer pause or a topic shift should be reflected in a larger time gap. The goal is to make the timestamps feel contextually relevant and not just mechanically placed.";
            }
        }
        
        let glossaryInstruction = '';
        if (glossary && glossary.length > 0) {
            const glossaryItems = glossary.map(g => `- Term: "${g.term}", Use: "${g.definition}"`).join('\n');
            glossaryInstruction = `\n\nCRITICAL: You MUST strictly adhere to the following custom glossary for accuracy and consistency:\n${glossaryItems}`;
        }

        const prompt = `You are an expert transcriber and editor for a major newspaper.
Your task is to format the following raw audio transcript into a specific format.
${glossaryInstruction}

Input Language Details: ${languageHint}

Desired Output Format: ${formatInstruction}

Please process the raw transcript below and provide only the formatted output, without any additional comments or explanations.

Raw Transcript:
---
${transcript}
---
    `;
        
        if (format === 'json') {
            const jsonSchema = {
                type: Type.OBJECT,
                properties: {
                    transcript: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                speaker: { type: Type.STRING, description: "The identified speaker. Use generic labels like 'Speaker A', 'Speaker B' if names are not explicitly mentioned." },
                                dialogue: { type: Type.STRING, description: "The dialogue spoken by the speaker." },
                            },
                            required: ['speaker', 'dialogue'],
                        },
                    },
                },
                required: ['transcript'],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema,
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });
            return response.text;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });

        return response.text;
    } catch (error) {
        throw handleGeminiError(error);
    }
};
