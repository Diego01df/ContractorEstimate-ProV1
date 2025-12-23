
import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES, PAYMENT_TERMS } from "../types";

// Always initialize GoogleGenAI with the apiKey parameter from process.env.API_KEY right before making a call.
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
};

export async function validateAddress(query: string): Promise<{ street: string, city: string, state: string, zip: string } | null> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Locate the specific physical address for: "${query}". 
      
      Return the address details strictly in this JSON format:
      {
        "street": "number and street name",
        "city": "city name",
        "state": "2-letter state code",
        "zip": "zip/postal code"
      }

      Do not include any other text, just the JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Use .text property directly instead of text() method.
    const text = response.text;
    if (!text) return null;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
            street: data.street || "",
            city: data.city || "",
            state: data.state || "",
            zip: data.zip || ""
        };
    }
    return null;
  } catch (error) {
    console.error("Gemini Address Error:", error);
    return null;
  }
}

export async function getEstimatedPrice(description: string, zip: string, category: string): Promise<{ materialPrice: number, laborPrice: number, unit: string, reasoning: string, sources: string[] }> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find current average contractor pricing for "${description}" (${category}) in zip code ${zip}.
      
      Return strictly in this JSON format:
      {
        "materialPrice": number,
        "laborPrice": number,
        "unit": "string",
        "reasoning": "string"
      }`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Use .text property directly instead of text() method.
    const text = response.text;
    if (!text) throw new Error("No response");
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        // Extract URLs from groundingChunks when googleSearch is used.
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((c: any) => c.web?.uri)
            .filter(Boolean) || [];

        return {
            materialPrice: data.materialPrice || 0,
            laborPrice: data.laborRate || data.laborPrice || 0,
            unit: data.unit || 'ea',
            reasoning: data.reasoning || '',
            sources
        };
    }
    throw new Error("Invalid JSON");
  } catch (error) {
    console.error("Price Error:", error);
    return { materialPrice: 0, laborPrice: 0, unit: 'ea', reasoning: "Pricing error.", sources: [] };
  }
}

export async function analyzeScopeAndGenerateItems(scopeText: string, roomName: string, zip: string): Promise<any[]> {
  try {
    const ai = getAI();
    const prompt = `As a Senior Construction Estimator, perform a targeted analysis for a specific space: "${roomName}" in zip code "${zip}".
    
    SPACE CONTEXT: This is for the ${roomName}. Ignore other rooms unless they directly affect this space's scope.
    
    SCOPE OF WORK INPUT:
    "${scopeText}"
    
    RULES FOR INTERPRETATION:
    1. Categorize all work into these EXACT categories: ${CATEGORIES.join(', ')}.
    2. For a ${roomName}, prioritize typical requirements (e.g., wet area considerations for bathrooms, flooring for living rooms).
    3. Estimate quantities and units realistically for a room of this type.
    4. Provide specific descriptions for each line item that explain exactly what is being done in the ${roomName}.
    5. Return a JSON array of line items. Each item must have: 
       - category: (Exact string from the list)
       - description: (Detailed task explanation for the client, e.g., 'Install 12x24 porcelain tile on bathroom floor')
       - unit: (sq ft, ea, lft, allowance, etc.)
       - quantity: number
       - unitPrice: number (material cost)
       - laborRate: number (labor cost)
       - ecoProfit: 20
       - markup: 0
       - notes: string
       - paymentDue: (One of: ${PAYMENT_TERMS.join(', ')})
    
    Return ONLY the JSON array. Ensure the interpretation is specific to the ${roomName} only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    // Use .text property directly instead of text() method.
    const text = response.text;
    if (!text) return [];

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const items = JSON.parse(cleanJson);
    
    if (Array.isArray(items)) {
        return items.map(item => ({
            ...item,
            category: CATEGORIES.includes(item.category) ? item.category : "Custom Work",
            paymentDue: PAYMENT_TERMS.includes(item.paymentDue) ? item.paymentDue : PAYMENT_TERMS[0],
            description: item.description || ""
        }));
    }
    return [];
  } catch (error) {
    console.error("Scope Analysis Error:", error);
    return [];
  }
}
