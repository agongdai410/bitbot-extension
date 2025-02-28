import "@/assets/main.css"

import { createApp } from "vue"
import Popup from "./Popup.vue"
import { i18n } from "@/utils/i18n"
import { MessageType } from "@/types"
import { messageInvoke } from "@/utils/invoke"

const app = createApp(Popup)

app.use(i18n)
app.mount("#app")

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MessageType.invokeResponse:
      messageInvoke.handleResMsg(message)
      break
    case MessageType.invokeRequest:
      messageInvoke.handleReqMsg(message, sender)
      break
  }
})
