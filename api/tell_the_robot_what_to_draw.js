// File: /api/tell_the_robot_what_to_draw.js

// These are the instructions for our robot helper.
export default async function handler(req, res) {

  // 1. The robot listens for a friend from the playground to ask for a drawing.
  // It gets the idea for the drawing (like "a blue dog") from the request.
  const drawingIdea = req.body.prompt;

  // 2. The robot goes to the locked safe (Environment Variables)
  // and gets the magic key. Notice, it's not written down here! It's secret!
  const magicKey = process.env.GOOGLE_API_KEY;

  // 3. The robot runs over to Google's giant toy box with the magic key and the drawing idea.
  const responseFromGoogle = await fetch(`https://some-google-cloud-api.googleapis.com/v1/images:generate?key=${magicKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: drawingIdea, // Tells Google what to draw
    }),
  });

  // 4. The robot gets the finished picture from Google.
  const finishedPicture = await responseFromGoogle.json();

  // 5. The robot brings the picture back and hands it to the friend in the playground.
  // The magic key never, ever leaves the clubhouse!
  res.status(200).json(finishedPicture);
}
