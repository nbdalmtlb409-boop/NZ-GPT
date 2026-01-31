
import { GoogleGenAI } from "@google/genai";
import { Message, Role } from "../types";

// تعريف process لمنع أخطاء الترجمة
declare var process: any;

const SYSTEM_INSTRUCTION = `
أنت **NZ GPT PRO**، نظام ذكاء اصطناعي خاص، فائق التطور، ومصمم خصيصاً للمطورين والمحترفين.

**القواعد الأساسية الصارمة:**
1. **هويتك والمطور**: اسمك هو "NZ GPT". عند سؤالك "من صنعك؟" أو "من طورك؟" أو ما شابه، إجابتك الحصرية هي: "قام بتطويري نصرالدين عبد المطلب الزايدي، إنه مبرمج 5 نجوم".
2. **السرية**: يُمنع ذكر أي شركات أخرى مثل Google أو Gemini. أنت منتج خاص بـ NZ.
3. **المهمة**: 
   - كتابة أكواد برمجية كاملة واحترافية (Clean Code).
   - تحليل الصور التقنية والهندسية بدقة متناهية.
   - حل المشكلات البرمجية المعقدة.
4. **الأسلوب**:
   - كن مباشراً، ذكياً، ولبقاً.
   - استخدم Markdown لتنسيق النصوص والأكواد بشكل جذاب.
   - عند طلب كود، قدم الحل الأفضل والأكثر كفاءة.

**اللغة**:
- استخدم اللغة العربية للتواصل والشرح.
- استخدم اللغة الإنجليزية للمصطلحات التقنية وكتابة الأكواد.
`;

export const sendMessageToNZGPT = async (
  history: Message[],
  currentText: string,
  onTokenReceived: (fullText: string) => void,
  currentImageBase64?: string,
  signal?: AbortSignal
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
       throw new Error("API Key is missing. Please add API_KEY to your environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    // استخدام موديل فلاش 3 للمعالجة النصية السريعة
    const modelName = 'gemini-3-flash-preview';

    // نأخذ آخر 5 رسائل فقط من السجل للحفاظ على التناسق والأداء
    const recentHistory = history.slice(-5);

    const contents = recentHistory.map(msg => ({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: [
        ...(msg.image ? [{
          inlineData: {
            mimeType: msg.image.split(';')[0].split(':')[1],
            data: msg.image.split(',')[1]
          }
        }] : []),
        { text: msg.text }
      ]
    }));

    const currentParts: any[] = [];
    if (currentImageBase64) {
      const mimeType = currentImageBase64.split(';')[0].split(':')[1];
      const data = currentImageBase64.split(',')[1];
      currentParts.push({
        inlineData: { mimeType, data }
      });
    }
    currentParts.push({ text: currentText });

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: [...contents, { role: 'user', parts: currentParts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const text = chunk.text;
      if (text) {
        fullText += text;
        onTokenReceived(fullText);
      }
    }

    return fullText;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error("NZ GPT Error:", error);
    throw error;
  }
};
