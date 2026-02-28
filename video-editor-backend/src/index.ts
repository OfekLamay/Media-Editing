import express from 'express';
import type { Request, Response } from 'express';


const app = express();
const PORT = 3003;

app.get('/', (req: Request, res: Response) => {
  res.send('This is the video editor backend!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});