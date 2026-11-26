import { Link } from 'react-router-dom';
import { t } from '@/i18n';

export default function NotFound() {
  return (
    <main className="container flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{t('wayIn.pages.notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('wayIn.pages.notFoundText')}</p>
      <Link to="/" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
        {t('wayIn.pages.backHome')}
      </Link>
    </main>
  );
}
