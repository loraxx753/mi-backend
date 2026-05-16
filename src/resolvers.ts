import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { AnalysisRecordModel } from './models/AnalysisRecord.js';

// Fallback to your analysis endpoint if the environment variable isn't set
const DEFAULT_MODAL_URL = process.env.MODAL_ENGINE_URL || "https://loraxx753--mi-observatory-model-analyze.modal.run";
const DEFAULT_INSPECT_SOURCE = (process.env.INSPECT_SOURCE || 'MOCK').toUpperCase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIXTURE_PATH = process.env.INSPECT_FIXTURE_PATH
  || path.join(__dirname, 'fixtures', 'inspect-snapshot.json');

type SnapshotSource = 'MOCK' | 'FIXTURE' | 'LIVE';

type SnapshotPayload = {
  tokens: string[];
  attention: number[][][];
  residual?: number[][];
  status?: string;
  device?: string;
};

type HeatmapCell = {
  head: number;
  query: string;
  key: string;
  value: number;
};

function buildHeatmap(tokens: string[], attention: number[][][]): HeatmapCell[] {
  if (!Array.isArray(tokens) || !Array.isArray(attention)) {
    return [];
  }

  const tokenLabel = (index: number) => `${index}: ${tokens[index] ?? ''}`;

  return attention.flatMap((headMatrix, headIndex) => {
    if (!Array.isArray(headMatrix)) {
      return [] as HeatmapCell[];
    }

    return headMatrix.flatMap((row, queryIndex) => {
      if (!Array.isArray(row)) {
        return [] as HeatmapCell[];
      }

      return row.map((value, keyIndex) => ({
        head: headIndex,
        query: tokenLabel(queryIndex),
        key: tokenLabel(keyIndex),
        value: Number(value),
      }));
    });
  });
}

function expectedHeatmapCellCount(attention: number[][][]): number {
  return attention.reduce((headAcc, headMatrix) => {
    if (!Array.isArray(headMatrix)) {
      return headAcc;
    }
    return headAcc + headMatrix.reduce((rowAcc, row) => {
      if (!Array.isArray(row)) {
        return rowAcc;
      }
      return rowAcc + row.length;
    }, 0);
  }, 0);
}

function validateSnapshotContracts(tokens: string[], attention: number[][][], heatmap: HeatmapCell[]): void {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('Contract check failed: tokens must be a non-empty array');
  }

  if (!Array.isArray(attention) || attention.length === 0) {
    throw new Error('Contract check failed: attention must be a non-empty 3D array');
  }

  const expectedCount = expectedHeatmapCellCount(attention);
  if (heatmap.length !== expectedCount) {
    throw new Error(`Contract check failed: expected ${expectedCount} heatmap cells, received ${heatmap.length}`);
  }

  const hasInvalidValue = heatmap.some((cell) => !Number.isFinite(cell.value));
  if (hasInvalidValue) {
    throw new Error('Contract check failed: heatmap contains non-finite values');
  }
}

function normalizeSource(source?: string): SnapshotSource {
  const value = (source || DEFAULT_INSPECT_SOURCE || 'MOCK').toUpperCase();
  if (value === 'FIXTURE' || value === 'LIVE' || value === 'MOCK') {
    return value;
  }
  return 'MOCK';
}

function loadFixtureSnapshot(): SnapshotPayload {
  try {
    const raw = fs.readFileSync(DEFAULT_FIXTURE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as SnapshotPayload;
    return {
      ...parsed,
      status: parsed.status || `Fixture snapshot loaded from ${DEFAULT_FIXTURE_PATH}`,
      device: parsed.device || 'Fixture',
    };
  } catch (error) {
    console.warn('Fixture load failed; falling back to mock snapshot', error);
    return {
      ...MOCK_SNAPSHOT,
      status: 'Fixture load failed; using mock snapshot fallback',
      device: 'MockGPU',
    };
  }
}

async function loadLiveSnapshot(
  prompt: string,
  layer: number,
  components: string[],
  customEndpoint?: string,
): Promise<SnapshotPayload> {
  const url = customEndpoint || DEFAULT_MODAL_URL;
  const response = await axios.post(url, {
    prompt,
    layer,
    components,
  });

  return {
    tokens: response.data.tokens,
    attention: response.data.attention,
    residual: response.data.residual,
    status: response.data.status || 'Live snapshot returned',
    device: response.data.device || 'LiveEngine',
  };
}

async function persistAnalysisIfEnabled(params: {
  persist: boolean;
  prompt: string;
  layer: number;
  components: string[];
  source: SnapshotSource;
  snapshot: SnapshotPayload;
  heatmap: HeatmapCell[];
}): Promise<void> {
  if (!params.persist) {
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const componentsKey = params.components.join('|');
  await AnalysisRecordModel.findOneAndUpdate(
    {
      prompt: params.prompt,
      layer: params.layer,
      componentsKey,
      source: params.source,
    },
    {
      $set: {
        prompt: params.prompt,
        layer: params.layer,
        components: params.components,
        componentsKey,
        source: params.source,
        tokens: params.snapshot.tokens,
        attention: params.snapshot.attention,
        visualizations: { heatmap: params.heatmap },
        status: params.snapshot.status,
        device: params.snapshot.device,
      },
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
}

function mapStoredAnalysis(doc: any) {
  return {
    id: String(doc._id),
    prompt: doc.prompt,
    layer: doc.layer,
    components: doc.components,
    source: doc.source,
    tokens: doc.tokens,
    attention: doc.attention,
    visualizations: doc.visualizations,
    status: doc.status,
    device: doc.device,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

const MOCK_SNAPSHOT = {
  "tokens": [
    "<|endoftext|>",
    "The",
    " quick",
    " brown",
    " fox"
  ],
  "attention": [
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.9330379366874695,
        0.06696208566427231,
        0,
        0,
        0
      ],
      [
        0.7240484356880188,
        0.20324362814426422,
        0.07270795106887817,
        0,
        0
      ],
      [
        0.5841508507728577,
        0.11828780919313431,
        0.040438149124383926,
        0.257123202085495,
        0
      ],
      [
        0.36514201760292053,
        0.12901408970355988,
        0.13652192056179047,
        0.2963060438632965,
        0.07301594316959381
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.0013863509520888329,
        0.9986135959625244,
        0,
        0,
        0
      ],
      [
        0.00011073765926994383,
        0.001034627202898264,
        0.9988546371459961,
        0,
        0
      ],
      [
        0.0001344118791166693,
        0.0018865464953705668,
        0.0005549309425987303,
        0.9974241256713867,
        0
      ],
      [
        0.000009944455996446777,
        0.001249627792276442,
        0.00015627789252903312,
        0.0012202064972370863,
        0.9973639845848083
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.9405120015144348,
        0.05948800593614578,
        0,
        0,
        0
      ],
      [
        0.8745453953742981,
        0.10894910991191864,
        0.016505451872944832,
        0,
        0
      ],
      [
        0.7756410837173462,
        0.14825649559497833,
        0.0451013445854187,
        0.03100108541548252,
        0
      ],
      [
        0.7483621835708618,
        0.13607138395309448,
        0.022462783381342888,
        0.04155762121081352,
        0.05154603719711304
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.4126834273338318,
        0.587316632270813,
        0,
        0,
        0
      ],
      [
        0.027953369542956352,
        0.0061353216879069805,
        0.9659113883972168,
        0,
        0
      ],
      [
        0.020400088280439377,
        0.000542165245860815,
        0.03713763505220413,
        0.9419201612472534,
        0
      ],
      [
        0.0035998811945319176,
        0.00016972377488855273,
        0.0002007763396250084,
        0.029014116153120995,
        0.9670155048370361
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.8783947229385376,
        0.1216052919626236,
        0,
        0,
        0
      ],
      [
        0.19764788448810577,
        0.06137685850262642,
        0.7409752011299133,
        0,
        0
      ],
      [
        0.023597007617354393,
        0.004653629846870899,
        0.01064850203692913,
        0.9611009359359741,
        0
      ],
      [
        0.031274110078811646,
        0.007217993959784508,
        0.005625318735837936,
        0.06727057695388794,
        0.8886120319366455
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.2307664304971695,
        0.7692335247993469,
        0,
        0,
        0
      ],
      [
        0.11482581496238708,
        0.00014695235586259514,
        0.8850271701812744,
        0,
        0
      ],
      [
        0.01726496033370495,
        0.0000036284891393734142,
        0.000009679515642346814,
        0.982721745967865,
        0
      ],
      [
        0.012287940829992294,
        0.000006954929631319828,
        0.000002808989847835619,
        0.00010389913950348273,
        0.9875983595848083
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.973415195941925,
        0.026584738865494728,
        0,
        0,
        0
      ],
      [
        0.7261030077934265,
        0.11561321467161179,
        0.15828371047973633,
        0,
        0
      ],
      [
        0.6579518914222717,
        0.134494349360466,
        0.08709636330604553,
        0.12045732885599136,
        0
      ],
      [
        0.4581119418144226,
        0.2285858541727066,
        0.03878403827548027,
        0.07974518835544586,
        0.19477292895317078
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.9788066744804382,
        0.02119339257478714,
        0,
        0,
        0
      ],
      [
        0.6140565276145935,
        0.3134431540966034,
        0.0725003182888031,
        0,
        0
      ],
      [
        0.38001638650894165,
        0.25874456763267517,
        0.2126474529504776,
        0.14859159290790558,
        0
      ],
      [
        0.2717963457107544,
        0.30835840106010437,
        0.18281793594360352,
        0.17162089049816132,
        0.06540638953447342
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.799264132976532,
        0.2007359117269516,
        0,
        0,
        0
      ],
      [
        0.7801033854484558,
        0.17606507241725922,
        0.043831486254930496,
        0,
        0
      ],
      [
        0.5146986842155457,
        0.12583014369010925,
        0.12779806554317474,
        0.23167309165000916,
        0
      ],
      [
        0.5371065139770508,
        0.15193811058998108,
        0.08874749392271042,
        0.15489965677261353,
        0.06730823963880539
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.8372090458869934,
        0.16279089450836182,
        0,
        0,
        0
      ],
      [
        0.7861249446868896,
        0.15263743698596954,
        0.06123754009604454,
        0,
        0
      ],
      [
        0.7224429249763489,
        0.16158181428909302,
        0.08346671611070633,
        0.032508570700883865,
        0
      ],
      [
        0.6952270269393921,
        0.14395248889923096,
        0.0709434524178505,
        0.08110781013965607,
        0.008769177831709385
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.7383902072906494,
        0.261609822511673,
        0,
        0,
        0
      ],
      [
        0.6093457341194153,
        0.16892297565937042,
        0.2217312902212143,
        0,
        0
      ],
      [
        0.5015449523925781,
        0.20313400030136108,
        0.06364842504262924,
        0.23167261481285095,
        0
      ],
      [
        0.5031977295875549,
        0.19159916043281555,
        0.03763929754495621,
        0.0503922700881958,
        0.21717151999473572
      ]
    ],
    [
      [
        1,
        0,
        0,
        0,
        0
      ],
      [
        0.7672995328903198,
        0.23270045220851898,
        0,
        0,
        0
      ],
      [
        0.669391930103302,
        0.17994853854179382,
        0.15065959095954895,
        0,
        0
      ],
      [
        0.5008507966995239,
        0.20964689552783966,
        0.17558278143405914,
        0.11391957849264145,
        0
      ],
      [
        0.3756057620048523,
        0.14178326725959778,
        0.15483568608760834,
        0.1290053427219391,
        0.1987699270248413
      ]
    ]
  ]
}



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

    inspect: async (_: any, { prompt, layer, components, source, persist, customEndpoint }: any) => {
      const resolvedSource = normalizeSource(source);
      let snapshot: SnapshotPayload;

      if (resolvedSource === 'FIXTURE') {
        snapshot = loadFixtureSnapshot();
      } else if (resolvedSource === 'LIVE') {
        snapshot = await loadLiveSnapshot(prompt, layer, components, customEndpoint);
      } else {
        snapshot = {
          ...MOCK_SNAPSHOT,
          status: 'Mock snapshot returned',
          device: 'MockGPU',
        };
      }

      const heatmap = buildHeatmap(snapshot.tokens, snapshot.attention);
      validateSnapshotContracts(snapshot.tokens, snapshot.attention, heatmap);

      await persistAnalysisIfEnabled({
        persist: persist ?? true,
        prompt,
        layer,
        components,
        source: resolvedSource,
        snapshot,
        heatmap,
      });

      return {
        prompt,
        tokens: snapshot.tokens,
        attention: snapshot.attention,
        visualizations: {
          heatmap,
        },
        status: snapshot.status,
        device: snapshot.device,
        residual: snapshot.residual,
      };
    },

    analysisHistory: async (_: any, { prompt, limit }: { prompt?: string; limit?: number }) => {
      const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100);
      const filter = prompt
        ? { prompt: { $regex: prompt, $options: 'i' } }
        : {};

      const docs = await AnalysisRecordModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .limit(safeLimit)
        .lean();

      return docs.map(mapStoredAnalysis);
    },

    /**
     * Direct Inspection: Fetches raw activations (Attention, Residuals, Tokens).
     */
    // inspect: async (_: any, { prompt, layer, components, customEndpoint }: any) => {
    //   const url = customEndpoint || DEFAULT_MODAL_URL;
      
    //   try {
    //     console.log(`Mission Control: Requesting Autopsy on Layer ${layer} for "${prompt}"`);
        
    //     const response = await axios.post(url, {
    //       prompt,
    //       layer,
    //       components // Sends the ModelComponent Enum array
    //     });

    //     console.log("Raw Snapshot Response:", response.data);

    //     // Maps the Python JSON response directly to the ModelSnapshot type
    //     return {
    //       tokens: response.data.tokens,
    //       attention: response.data.attention,
    //       visualizations: {
    //         heatmap: buildHeatmap(response.data.tokens, response.data.attention),
    //       },
    //       residual: response.data.residual,
    //       status: response.data.status,
    //       device: response.data.device
    //     };
    //   } catch (error: any) {
    //     console.error("Inspect Failed:", error.message);
    //     throw new Error("The Model Brain failed to return a snapshot.");
    //   }
    // },

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