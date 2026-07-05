import React, { useState } from "react";
import { Stack } from "expo-router";
import ChatbotButton from "../components/ChatbotButton";
import AppIntroFlow from "../components/AppIntroFlow";

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);

  if (showIntro) {
    return <AppIntroFlow onFinish={() => setShowIntro(false)} />;
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="parent-mode" options={{ headerShown: false }} />
        <Stack.Screen name="math-quest" options={{ headerShown: false }} />
      </Stack>
      <ChatbotButton />
    </>
  );
}
