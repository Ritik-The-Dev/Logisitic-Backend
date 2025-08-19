/* Packages */
import app from './app';
import { PORT } from './config/constant';

/* Server Listening */
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
