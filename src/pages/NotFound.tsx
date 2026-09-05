import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="container flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Nothing lives here</h1>
      <p className="text-muted-foreground">That page does not exist.</p>
      <Link to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
        Back home
      </Link>
    </main>
  );
}
