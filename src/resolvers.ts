import axios from 'axios';

// Fallback to your analysis endpoint if the environment variable isn't set
const DEFAULT_MODAL_URL = process.env.MODAL_ENGINE_URL || "https://loraxx753--mi-observatory-model-analyze.modal.run";

export const resolvers = {
  Query: {
    /**
     * Ignition Check: Verifies the GPU engine is warm and responsive.
     */
    engineStatus: async () => {
      try {
        // Calls the /status helper on your Modal engine
        const response = await axios.get(`${DEFAULT_MODAL_URL}/status`);
        return {
          isLive: true,
          modelLoaded: response.data.model || "gpt2-small",
          gpuType: response.data.gpu || "A10G"
        };
      } catch (e) {
        console.error("Linker Error: Remote Brain unreachable");
        return { isLive: false, modelLoaded: null, gpuType: null };
      }
    },

    /**
     * Direct Inspection: Fetches raw activations (Attention, Residuals, Tokens).
     */
    inspect: async (_: any, { prompt, layer, components, customEndpoint }: any) => {
      const url = customEndpoint || DEFAULT_MODAL_URL;
      
      try {
        console.log(`Mission Control: Requesting Autopsy on Layer ${layer} for "${prompt}"`);
        
        const response = await axios.post(url, {
          prompt,
          layer,
          components // Sends the ModelComponent Enum array
        });

        // Maps the Python JSON response directly to the ModelSnapshot type
        return {
          tokens: response.data.tokens,
          attention: response.data.attention,
          residual: response.data.residual,
          status: response.data.status,
          device: response.data.device
        };
      } catch (error: any) {
        console.error("Inspect Failed:", error.message);
        throw new Error("The Model Brain failed to return a snapshot.");
      }
    },

    /**
     * Geometric Compute: Offloads heavy linear algebra (PCA, Cosine) to the GPU.
     */
    compute: async (_: any, { prompt, layer, task, customEndpoint }: any) => {
      const url = customEndpoint || DEFAULT_MODAL_URL;

      try {
        console.log(`Mission Control: Requesting ${task} Compute for "${prompt}"`);
        
        const response = await axios.post(url, {
          prompt,
          layer,
          task // Sends PCA_3D or COSINE_SIMILARITY
        });

        // Returns "D3-ready" points or matrices
        return {
          points: response.data.points,
          matrix: response.data.matrix,
          status: response.data.status
        };
      } catch (error: any) {
        console.error("Compute Failed:", error.message);
        throw new Error("Geometric math offloading failed on the remote engine.");
      }
    }
  }
};