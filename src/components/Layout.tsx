import React from 'react';
import { Navbar } from './Navbar';
import styles from './Layout.module.css';

export interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className={styles.appWrapper}>
      <Navbar />
      <div className={styles.mainContainer}>
        {children}
      </div>
    </div>
  );
};
