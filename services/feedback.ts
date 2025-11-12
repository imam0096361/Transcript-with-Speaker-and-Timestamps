// This is a mock feedback service.
// In a real application, this would send data to a secure backend endpoint
// for storage and analysis. For this example, we'll just log it to the console.

interface FeedbackPayload {
    rating: 'good' | 'bad';
    comment?: string;
    rawTranscript: string;
    formattedTranscript: string;
    format: string;
    language: string;
    settings: {
        withFormattedTimestamps: boolean;
        withSpeakerLabels: boolean;
    };
}

export const submitFeedback = (payload: FeedbackPayload): void => {
    console.log("--- FEEDBACK SUBMITTED ---");
    console.log("Rating:", payload.rating);
    if (payload.comment) {
        console.log("Comment:", payload.comment);
    }
    console.log("Settings:", payload.settings);
    console.log("Format:", payload.format);
    console.log("Language:", payload.language);
    
    // In a real scenario, you might only send excerpts or IDs
    // to respect user privacy and reduce payload size.
    console.log("Raw Transcript (first 100 chars):", payload.rawTranscript.substring(0, 100) + '...');
    console.log("Formatted Transcript (first 100 chars):", payload.formattedTranscript.substring(0, 100) + '...');
    
    console.log("--- END OF FEEDBACK ---");

    // Here you would typically use fetch() to POST this payload to your server.
    // fetch('/api/feedback', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload)
    // });
};
