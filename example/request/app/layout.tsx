import type { ReactNode } from 'react';
import { StoreProvider } from './StoreProvider';

import './styles/globals.css';

interface Props {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: Props) {
  return (
    <StoreProvider>
      <html lang='en'>
        <body>
          <main>
            {children}
          </main>
        </body>
      </html>
    </StoreProvider>
  );
}
