"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bookbot-admin-key";

export function useAdminKey() {
  const [adminKey, setAdminKeyState] = useState("");

  useEffect(() => {
    setAdminKeyState(localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  function setAdminKey(value: string) {
    const nextValue = value.trim();
    setAdminKeyState(nextValue);

    if (nextValue) {
      localStorage.setItem(STORAGE_KEY, nextValue);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return { adminKey, setAdminKey };
}
