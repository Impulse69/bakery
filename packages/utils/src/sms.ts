export async function sendSMS(to: string[], message: string) {
  const apiKey = process.env.TEXIFY_API_KEY;
  const senderId = process.env.TEXIFY_SENDER_ID || 'BRD-FACULTY';

  if (!apiKey) {
    console.warn('SMS alert skipped: TEXIFY_API_KEY not configured.');
    return;
  }

  try {
    const response = await fetch('https://api.texify.org/api/v1/messages/send', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: to,
        message,
        senderId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Texify API error:', JSON.stringify(result, null, 2));
    } else {
      console.log(`SMS alert sent to ${to.join(', ')}. Response: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.error('Failed to send SMS via Texify:', error);
  }
}
