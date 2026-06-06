import {
  waitForEvenAppBridge,
  StartUpPageCreateResult,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  ImuReportPace,
  type EvenHubEvent,
  type LaunchSource,
  CreateStartUpPageContainer,
  ImageContainerProperty,
  RebuildPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";
import type { TextStyle, DisplayMode } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_TEXT_STYLE } from "../types";
import {
  renderParagraphToFourQuadrants,
  QUAD_PANEL_WIDTH,
  QUAD_PANEL_HEIGHT,
} from "../hebrewToBmp";
import { logger } from "../utils/logger";

export class EvenHubService {
  private bridge: any = null;
  private startupPageCreated: boolean = false;
  private eventUnsubscribe: (() => void) | null = null;
  private launchSourceUnsubscribe: (() => void) | null = null;
  private isInitializingContainer: boolean = false;
  private initializationPromise: Promise<boolean> | null = null;
  private launchSource: LaunchSource | null = null;
  private imuEnabled = false;
  private onImuDataCallback:
    | ((imu: { x: number; y: number; z: number }) => void)
    | null = null;
  private presentationSlideModeActive = false;
  private presentationTemporarilyHidden = false;
  private lastPresentationQuadrants: Uint8Array[] | null = null;

  // Four quadrant image containers (2×2 grid). SDK allows max 4 containers total, so no separate event/timer.
  private static readonly SLIDE_IMAGE_CONTAINER_IDS = [1, 2, 3, 4] as const;
  private static readonly SLIDE_IMAGE_CONTAINER_NAMES = [
    "slide-img-1",
    "slide-img-2",
    "slide-img-3",
    "slide-img-4",
  ] as const;
  private static readonly SLIDE_EVENT_CAPTURE_CONTAINER_ID = 5;
  private static readonly SLIDE_EVENT_CAPTURE_CONTAINER_NAME = "slide-evt";
  // Loading sequence: top-right (1), top-left (0), bottom-right (3), bottom-left (2)
  private static readonly QUADRANT_LOAD_ORDER = [1, 0, 3, 2] as const;

  // Real Text Prompter: list + text on glasses (createStartUpPageContainer or rebuildPageContainer)
  private static readonly RTP_LIST_CONTAINER_ID = 10;
  private static readonly RTP_LIST_CONTAINER_NAME = "rtp-list";
  private static readonly RTP_TEXT_CONTAINER_ID = 11;
  private static readonly RTP_TEXT_CONTAINER_NAME = "rtp-text";
  private static readonly RTP_ITEM_NAME_MAX = 64;
  // private static readonly RTP_TEXT_CONTENT_MAX = 2000;
  private rtpBlocks: { title?: string; content: string }[] | null = null;
  private rtpTextFocusActive = false;
  /** RTP slide mode: content split by double newline, each shown as BMP; scroll/tap = next/prev, double-tap = back to list */
  private rtpSlideMode = false;
  private rtpSlides: string[] = [];
  private rtpSlideIndex = 0;

  // Image dimensions - SDK limits: width 20-200, height 20-100; we use 200×100 per quadrant
  public static readonly SLIDE_IMAGE_WIDTH = QUAD_PANEL_WIDTH;
  public static readonly SLIDE_IMAGE_HEIGHT = QUAD_PANEL_HEIGHT;

  /** Convert BMP Uint8Array to number[] for reliable bridge/native transfer (SDK recommends number[]) */
  private static imageDataForBridge(bmp: Uint8Array): number[] {
    return Array.from(bmp);
  }

  /** Returns the 4 image container properties for 2×2 quadrant layout (shared by displaySlide and RTP slide mode). */
  private static getFourQuadrantImageContainers(): ImageContainerProperty[] {
    const startX = Math.floor((CANVAS_WIDTH - 400) / 2);
    const startY = Math.floor((CANVAS_HEIGHT - 200) / 2);
    const cw = EvenHubService.SLIDE_IMAGE_WIDTH;
    const ch = EvenHubService.SLIDE_IMAGE_HEIGHT;
    return [
      new ImageContainerProperty({
        xPosition: startX,
        yPosition: startY,
        width: cw,
        height: ch,
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[0],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[0],
      }),
      new ImageContainerProperty({
        xPosition: startX + cw,
        yPosition: startY,
        width: cw,
        height: ch,
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[1],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[1],
      }),
      new ImageContainerProperty({
        xPosition: startX,
        yPosition: startY + ch,
        width: cw,
        height: ch,
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[2],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[2],
      }),
      new ImageContainerProperty({
        xPosition: startX + cw,
        yPosition: startY + ch,
        width: cw,
        height: ch,
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[3],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[3],
      }),
    ];
  }

  /** Full-screen text container for scroll/tap events; also shows "loading" between slides via textContainerUpgrade. */
  private static getSlideEventCaptureTextContainer(): TextContainerProperty {
    return new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      containerID: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_ID,
      containerName: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_NAME,
      content: " ",
      borderWidth: 0,
      paddingLength: 0,
      isEventCapture: 1,
    });
  }

  /** Fast glasses-only loading indicator — single textContainerUpgrade, no BMP re-render. */
  async showLoadingOnGlasses(
    slideNumber: number,
    totalSlides: number,
  ): Promise<void> {
    if (!this.bridge || !this.startupPageCreated) return;
    try {
      await this.bridge.textContainerUpgrade({
        containerID: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_ID,
        containerName: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_NAME,
        content: `loading ${slideNumber} / ${totalSlides}`,
      });
    } catch (error) {
      logger.device("Failed to show loading on glasses", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clearLoadingOnGlasses(): Promise<void> {
    if (!this.bridge || !this.startupPageCreated) return;
    try {
      await this.bridge.textContainerUpgrade({
        containerID: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_ID,
        containerName: EvenHubService.SLIDE_EVENT_CAPTURE_CONTAINER_NAME,
        content: " ",
      });
    } catch (error) {
      logger.device("Failed to clear loading on glasses", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async initialize(): Promise<boolean> {
    // If already initialized, return true immediately
    if (this.bridge !== null) {
      logger.connection("SDK already initialized - reusing existing bridge");
      return true;
    }

    logger.connection("Initializing EvenHub bridge...");
    logger.connection("Waiting for Even App bridge connection...");
    logger.connection(
      "⚠️ IMPORTANT: Make sure the app is opened from Even App (not regular browser)",
    );

    try {
      const BRIDGE_TIMEOUT_MS = 15000;
      logger.connection(`Bridge timeout set to ${BRIDGE_TIMEOUT_MS}ms`);

      this.bridge = await Promise.race([
        waitForEvenAppBridge().then((bridge) => {
          logger.connectionSuccess("Bridge connection established!");
          logger.device("Bridge object received:", {
            hasBridge: !!bridge,
            bridgeType: typeof bridge,
          });
          return bridge;
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            logger.connectionError(
              "Bridge timeout - Ensure app is opened from Even App",
            );
            logger.connectionError(
              "The app must be opened from Even App, not a regular browser",
            );
            logger.connectionError(
              "Use: npm run qr to generate QR code, then scan with Even App",
            );
            reject(
              new Error(
                "Bridge timeout. Ensure the app is opened from Even App.",
              ),
            );
          }, BRIDGE_TIMEOUT_MS),
        ),
      ]);

      if (!this.bridge) {
        logger.connectionError("Bridge object is null/undefined");
        throw new Error("Bridge not available");
      }

      if (!this.launchSourceUnsubscribe) {
        this.launchSourceUnsubscribe = this.bridge.onLaunchSource(
          (source: LaunchSource) => {
            this.launchSource = source;
            logger.device("Launch source received", { source });
          },
        );
      }

      logger.connectionSuccess("Bridge validated successfully");
      logger.device("Starting event listener...");
      this.startEventListening();
      logger.connectionSuccess("EvenHub service initialized successfully");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.connectionError("Failed to initialize EvenHub bridge", {
        error: errorMessage,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });
      // Don't set bridge to null on error - allow retry
      return false;
    }
  }

  getBridge() {
    return this.bridge;
  }

  isInitialized(): boolean {
    return this.bridge !== null;
  }

  getLaunchSource(): LaunchSource | null {
    return this.launchSource;
  }

  setImuDataCallback(
    callback: ((imu: { x: number; y: number; z: number }) => void) | null,
  ) {
    this.onImuDataCallback = callback;
  }

  async enableImu(
    reportPace: ImuReportPace = ImuReportPace.P500,
  ): Promise<boolean> {
    if (!this.bridge) return false;
    try {
      const ok = await this.bridge.imuControl(true, reportPace);
      this.imuEnabled = !!ok;
      logger.device(ok ? "IMU enabled" : "IMU enable failed", { reportPace });
      return !!ok;
    } catch (error) {
      logger.deviceError("Failed to enable IMU", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async disableImu(): Promise<boolean> {
    if (!this.bridge) return false;
    if (!this.imuEnabled) return true;
    try {
      const ok = await this.bridge.imuControl(false, ImuReportPace.P100);
      if (ok) this.imuEnabled = false;
      logger.device(ok ? "IMU disabled" : "IMU disable failed");
      return !!ok;
    } catch (error) {
      logger.deviceError("Failed to disable IMU", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Create or update the startup page container with slide content as BMP image.
   * Right panel = current slide, left panel = next slide (when provided).
   */
  async displaySlide(
    slideContent: string,
    style: TextStyle,
    displayMode: DisplayMode = "both",
    nextSlideContent?: string,
  ): Promise<boolean> {
    logger.device("Displaying slide on glasses", {
      contentLength: slideContent.length,
      displayMode,
      hasNextSlide: !!nextSlideContent,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
    });

    if (!this.bridge) {
      logger.deviceError("Cannot display slide - bridge not initialized");
      return false;
    }

    // Declare resolveInitRef at function scope for use in catch blocks
    let resolveInitRef: (value: boolean) => void = () => {};

    try {
      logger.device(
        "Rendering paragraph to 4-quadrant BMPs (one full screen)",
        {
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          alignment: style.alignment,
          inverted: style.inverted,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
        },
      );

      // One paragraph = one full 400×200 canvas split into 4 quadrants (200×100 each)
      const content = slideContent.trim() || " ";
      const [quad1, quad2, quad3, quad4] = renderParagraphToFourQuadrants(
        content,
        style,
      );
      const quadrantBmps: Uint8Array[] = [quad1, quad2, quad3, quad4];

      logger.deviceSuccess("4-quadrant BMPs generated", {
        sizes: quadrantBmps.map((b) => b.length),
        dimensions: `${EvenHubService.SLIDE_IMAGE_WIDTH}x${EvenHubService.SLIDE_IMAGE_HEIGHT}`,
      });

      // displayMode: for 4-panel we show same content on all quadrants; single-eye could blank half if needed later
      const blankBmp = this.createBlankBmp(
        EvenHubService.SLIDE_IMAGE_WIDTH,
        EvenHubService.SLIDE_IMAGE_HEIGHT,
      );
      const imagesToSend =
        displayMode === "right"
          ? [quadrantBmps[0], quadrantBmps[1], blankBmp, blankBmp]
          : displayMode === "left"
            ? [blankBmp, blankBmp, quadrantBmps[2], quadrantBmps[3]]
            : quadrantBmps;

      return await this.sendQuadrantImagesToDevice(imagesToSend);
    } catch (error) {
      this.isInitializingContainer = false;
      if (resolveInitRef) resolveInitRef(false);
      this.initializationPromise = null;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack";
      logger.deviceError("Exception during slide display", {
        error: errorMessage,
        stack: errorStack,
      });
      return false;
    }
  }

  /**
   * Display a slide using pre-rendered 4 quadrant BMPs (no render at display time).
   */
  async displaySlideWithPreRenderedQuadrants(
    quadrantBmps: Uint8Array[],
    displayMode: DisplayMode = "both",
  ): Promise<boolean> {
    if (!this.bridge) {
      logger.deviceError("Cannot display slide - bridge not initialized");
      return false;
    }
    if (
      !quadrantBmps ||
      quadrantBmps.length !== 4 ||
      quadrantBmps.some((b) => !b || b.length === 0)
    ) {
      logger.deviceError(
        "Invalid pre-rendered quadrants (need 4 non-empty BMPs)",
      );
      return false;
    }

    const blankBmp = this.createBlankBmp(
      EvenHubService.SLIDE_IMAGE_WIDTH,
      EvenHubService.SLIDE_IMAGE_HEIGHT,
    );
    const imagesToSend =
      displayMode === "right"
        ? [quadrantBmps[0], quadrantBmps[1], blankBmp, blankBmp]
        : displayMode === "left"
          ? [blankBmp, blankBmp, quadrantBmps[2], quadrantBmps[3]]
          : quadrantBmps;

    try {
      return await this.sendQuadrantImagesToDevice(imagesToSend);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.deviceError("Exception during pre-rendered slide display", {
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Send 4 quadrant images to the device. Shared by displaySlide and displaySlideWithPreRenderedQuadrants.
   */
  private async sendQuadrantImagesToDevice(
    imagesToSend: Uint8Array[],
  ): Promise<boolean> {
    let resolveInitRef: (value: boolean) => void = () => {};

    try {
      // If container is being initialized, wait for it to complete
      if (this.isInitializingContainer && this.initializationPromise) {
        logger.device(
          "Container initialization in progress - waiting for completion",
        );
        const initSuccess = await this.initializationPromise;
        if (!initSuccess) {
          logger.deviceError(
            "Container initialization failed - cannot update image",
          );
          return false;
        }
      }

      // If container already exists, just update the 4 quadrant image data
      if (this.startupPageCreated) {
        logger.device("Container exists - updating 4 quadrant images");

        await new Promise((resolve) => setTimeout(resolve, 100));
        const ok = await this.writeQuadrantImages(imagesToSend);
        if (!ok) return false;
        this.presentationSlideModeActive = true;
        this.presentationTemporarilyHidden = false;
        this.lastPresentationQuadrants = imagesToSend;
        logger.deviceSuccess("All 4 quadrant images updated on glasses");
        return true;
      }

      // First time: Create container
      // If already initializing, wait for that to complete first
      if (this.isInitializingContainer && this.initializationPromise) {
        logger.device("Container initialization already in progress - waiting");
        const initSuccess = await this.initializationPromise;
        if (!initSuccess) {
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        const ok = await this.writeQuadrantImages(imagesToSend);
        if (!ok) return false;
        this.presentationSlideModeActive = true;
        this.presentationTemporarilyHidden = false;
        this.lastPresentationQuadrants = imagesToSend;
        return true;
      }

      this.isInitializingContainer = true;
      logger.device(
        "First slide - Creating new container on glasses (4 quadrants + hidden text event capture)",
      );

      this.initializationPromise = new Promise<boolean>((resolve) => {
        resolveInitRef = resolve;
      });

      const imageContainers = EvenHubService.getFourQuadrantImageContainers();
      const eventCaptureTextContainer =
        EvenHubService.getSlideEventCaptureTextContainer();

      const allContainers: Array<{
        containerID?: number;
        containerName?: string;
        xPosition?: number;
        yPosition?: number;
        width?: number;
        height?: number;
      }> = [...imageContainers, eventCaptureTextContainer];

      // Check for overlaps and bounds violations
      for (const container of allContainers) {
        const right = (container.xPosition || 0) + (container.width || 0);
        const bottom = (container.yPosition || 0) + (container.height || 0);

        if (right > CANVAS_WIDTH || bottom > CANVAS_HEIGHT) {
          logger.deviceError("Container exceeds canvas bounds", {
            containerID: container.containerID,
            containerName: container.containerName,
            x: container.xPosition,
            y: container.yPosition,
            width: container.width,
            height: container.height,
            right,
            bottom,
            canvasWidth: CANVAS_WIDTH,
            canvasHeight: CANVAS_HEIGHT,
          });
          return false;
        }
      }

      const container = new CreateStartUpPageContainer({
        containerTotalNum: 5,
        imageObject: imageContainers,
        textObject: [eventCaptureTextContainer], // Required so scroll/tap/click events are captured in slide mode
      });

      const actualTotal =
        (container.imageObject?.length || 0) +
        (container.textObject?.length || 0) +
        (container.listObject?.length || 0);

      if (container.containerTotalNum !== actualTotal) {
        logger.deviceError("Container total mismatch", {
          declared: container.containerTotalNum,
          actual: actualTotal,
          imageObjects: container.imageObject?.length || 0,
          textObjects: container.textObject?.length || 0,
          listObjects: container.listObject?.length || 0,
        });
        return false;
      }

      logger.device(
        "Creating container on glasses (4 quadrants + event-capture text)",
        {
          containerTotalNum: container.containerTotalNum,
          imageObjects: container.imageObject?.length || 0,
          textObjects: container.textObject?.length || 0,
        },
      );

      const result = await this.bridge.createStartUpPageContainer(container);

      // Normalize result to handle different return types
      const normalizedResult =
        typeof result === "number"
          ? result
          : result === StartUpPageCreateResult.success
            ? 0
            : result;

      logger.device("Container creation response received", {
        result,
        normalizedResult,
        resultType: typeof result,
        isSuccess:
          normalizedResult === StartUpPageCreateResult.success ||
          normalizedResult === 0,
        resultEnum: Object.keys(StartUpPageCreateResult).find(
          (key) =>
            StartUpPageCreateResult[
              key as keyof typeof StartUpPageCreateResult
            ] === normalizedResult,
        ),
      });

      if (
        normalizedResult === StartUpPageCreateResult.success ||
        normalizedResult === 0
      ) {
        this.startupPageCreated = true;
        logger.deviceSuccess("Container created successfully on glasses");

        // Wait a bit before updating image data
        await new Promise((resolve) => setTimeout(resolve, 200));

        logger.device("Sending 4 quadrant image data to glasses...");
        // Load in sequence: top-right, top-left, bottom-right, bottom-left
        for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
          const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
          const quadrantName = [
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ][quadrantIdx];
          logger.device(
            `Loading quadrant ${quadrantIdx + 1} (${quadrantName}) - step ${orderIdx + 1}/4`,
          );

          const updateResult = await this.bridge.updateImageRawData({
            containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
            containerName:
              EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
            imageData: EvenHubService.imageDataForBridge(
              imagesToSend[quadrantIdx],
            ),
          });
          const isOk =
            updateResult === ImageRawDataUpdateResult.success ||
            (typeof updateResult === "string" && updateResult === "success") ||
            updateResult === 0;
          if (!isOk) {
            logger.deviceError("Failed to send quadrant image to glasses", {
              quadrant: quadrantIdx + 1,
              quadrantName,
              result: updateResult,
            });
            this.isInitializingContainer = false;
            if (resolveInitRef) resolveInitRef(false);
            this.initializationPromise = null;
            return false;
          }
          await new Promise((r) => setTimeout(r, 80));
        }

        this.isInitializingContainer = false;
        logger.deviceSuccess("All 4 quadrant images sent to glasses!");
        if (resolveInitRef) resolveInitRef(true);
        this.initializationPromise = null;
        this.presentationSlideModeActive = true;
        this.presentationTemporarilyHidden = false;
        this.lastPresentationQuadrants = imagesToSend;

        const quadrantArrays = imagesToSend.map((bmp) =>
          EvenHubService.imageDataForBridge(bmp),
        );
        setTimeout(async () => {
          try {
            logger.device(
              "Re-sending 4 quadrant images to ensure persistence...",
            );
            // Load in sequence: top-right, top-left, bottom-right, bottom-left
            for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
              const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
              await this.bridge.updateImageRawData({
                containerID:
                  EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
                containerName:
                  EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
                imageData: quadrantArrays[quadrantIdx],
              });
              await new Promise((r) => setTimeout(r, 80));
            }
            logger.deviceSuccess("Quadrant images re-sent");
          } catch (error) {
            logger.device("Failed to re-send quadrant images (non-critical)", {
              error,
            });
          }
        }, 300);

        logger.deviceSuccess("Slide successfully displayed on glasses!");
        return true;
      } else {
        this.isInitializingContainer = false;
        if (resolveInitRef) resolveInitRef(false);
        this.initializationPromise = null;
        logger.deviceError("Failed to create container on glasses", {
          result,
          expected: StartUpPageCreateResult.success,
          got: typeof result,
        });
        return false;
      }
    } catch (error) {
      this.isInitializingContainer = false;
      if (resolveInitRef) resolveInitRef(false);
      this.initializationPromise = null;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack";
      logger.deviceError("Exception during slide display", {
        error: errorMessage,
        stack: errorStack,
      });
      return false;
    }
  }

  private async writeQuadrantImages(
    imagesToSend: Uint8Array[],
  ): Promise<boolean> {
    // Load in sequence: top-right, top-left, bottom-right, bottom-left
    for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
      const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
      const quadrantName = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ][quadrantIdx];
      logger.device(
        `Loading quadrant ${quadrantIdx + 1} (${quadrantName}) - step ${orderIdx + 1}/4`,
      );

      const updateResult = await this.bridge.updateImageRawData({
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
        imageData: EvenHubService.imageDataForBridge(imagesToSend[quadrantIdx]),
      });
      const isOk =
        updateResult === ImageRawDataUpdateResult.success ||
        (typeof updateResult === "string" && updateResult === "success") ||
        updateResult === 0;
      if (!isOk) {
        logger.deviceError("Failed to update quadrant image on glasses", {
          quadrant: quadrantIdx + 1,
          quadrantName,
          result: updateResult,
        });
        return false;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return true;
  }

  private isDoubleTapFromEvent(event: EvenHubEvent): boolean {
    const readType = (raw?: Record<string, unknown>): number | null => {
      if (!raw) return null;
      const eventTypeRaw = raw.eventType ?? (raw as any).event_type;
      const et =
        typeof eventTypeRaw === "number" ? eventTypeRaw : Number(eventTypeRaw);
      return Number.isFinite(et) ? Math.floor(et) : null;
    };
    const sys = readType(
      event.sysEvent as unknown as Record<string, unknown> | undefined,
    );
    const text = readType(
      event.textEvent as unknown as Record<string, unknown> | undefined,
    );
    const list = readType(
      event.listEvent as unknown as Record<string, unknown> | undefined,
    );
    return (
      sys === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      text === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      list === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      sys === 3 ||
      text === 3 ||
      list === 3
    );
  }

  private async toggleTemporaryPresentationVisibility(): Promise<void> {
    if (
      !this.bridge ||
      !this.startupPageCreated ||
      !this.lastPresentationQuadrants
    )
      return;

    if (this.presentationTemporarilyHidden) {
      const ok = await this.writeQuadrantImages(this.lastPresentationQuadrants);
      if (ok) {
        this.presentationTemporarilyHidden = false;
        logger.deviceSuccess("Presentation restored after temporary hide");
      }
      return;
    }

    const blank = this.createBlankBmp(
      EvenHubService.SLIDE_IMAGE_WIDTH,
      EvenHubService.SLIDE_IMAGE_HEIGHT,
    );
    const ok = await this.writeQuadrantImages([blank, blank, blank, blank]);
    if (ok) {
      this.presentationTemporarilyHidden = true;
      logger.deviceSuccess("Presentation temporarily hidden");
    }
  }

  /**
   * Update slide content by re-rendering to 4 quadrants and updating all image data
   */
  async updateSlideContent(
    content: string,
    style: TextStyle,
  ): Promise<boolean> {
    if (!this.bridge || !this.startupPageCreated) {
      return false;
    }

    try {
      const [q1, q2, q3, q4] = renderParagraphToFourQuadrants(
        content.trim() || " ",
        style,
      );
      const quadrantBmps = [q1, q2, q3, q4];

      // Load in sequence: top-right, top-left, bottom-right, bottom-left
      for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
        const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
        const updateResult = await this.bridge.updateImageRawData({
          containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
          containerName:
            EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
          imageData: EvenHubService.imageDataForBridge(
            quadrantBmps[quadrantIdx],
          ),
        });
        const isOk =
          updateResult === ImageRawDataUpdateResult.success ||
          (typeof updateResult === "string" && updateResult === "success") ||
          updateResult === 0;
        if (!isOk) {
          logger.deviceError("Failed to update quadrant slide content", {
            quadrant: quadrantIdx + 1,
            result: updateResult,
          });
          return false;
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      logger.deviceSuccess("Slide content updated on glasses (4 quadrants)");
      return true;
    } catch (error) {
      logger.deviceError("Failed to update slide content", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Create a blank BMP image (all black pixels)
   */
  private createBlankBmp(width: number, height: number): Uint8Array {
    const bytesPerPixel = 3;
    const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4;
    const pixelDataSize = rowSize * height;
    const fileHeaderSize = 14;
    const dibHeaderSize = 40;
    const fileSize = fileHeaderSize + dibHeaderSize + pixelDataSize;

    const bmp = new Uint8Array(fileSize);
    const view = new DataView(bmp.buffer);
    let offset = 0;

    // BMP file header (14 bytes)
    bmp[offset++] = 0x42; // 'B'
    bmp[offset++] = 0x4d; // 'M'
    view.setUint32(offset, fileSize, true);
    offset += 4;
    view.setUint16(offset, 0, true);
    offset += 2;
    view.setUint16(offset, 0, true);
    offset += 2;
    view.setUint32(offset, fileHeaderSize + dibHeaderSize, true);
    offset += 4;

    // DIB header (BITMAPINFOHEADER, 40 bytes)
    view.setUint32(offset, dibHeaderSize, true);
    offset += 4;
    view.setInt32(offset, width, true);
    offset += 4;
    view.setInt32(offset, -height, true);
    offset += 4; // top-down
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, 24, true);
    offset += 2;
    view.setUint32(offset, 0, true);
    offset += 4;
    view.setUint32(offset, pixelDataSize, true);
    offset += 4;
    view.setInt32(offset, 0, true);
    offset += 4;
    view.setInt32(offset, 0, true);
    offset += 4;
    view.setUint32(offset, 0, true);
    offset += 4;
    view.setUint32(offset, 0, true);
    offset += 4;

    // Pixel data: All black pixels (BGR: 0,0,0)
    for (let y = 0; y < height; y++) {
      let rowPad = rowSize - width * bytesPerPixel;
      for (let x = 0; x < width; x++) {
        bmp[offset++] = 0; // B
        bmp[offset++] = 0; // G
        bmp[offset++] = 0; // R
      }
      while (rowPad--) bmp[offset++] = 0;
    }

    return bmp;
  }

  /**
   * Hide or show all 4 quadrant images on glasses.
   * When hide=true: sends blank black BMP to all 4 quadrants.
   * When hide=false: returns true so caller can restore via displaySlide.
   */
  async toggleImageVisibility(hide: boolean): Promise<boolean> {
    if (!this.bridge || !this.startupPageCreated) {
      logger.deviceError(
        "Cannot toggle image visibility - bridge not initialized or container not created",
      );
      return false;
    }

    try {
      logger.device(
        `${hide ? "Hiding" : "Showing"} 4 quadrant images on glasses...`,
      );

      if (!hide) {
        return true;
      }

      const blankBmp = this.createBlankBmp(
        EvenHubService.SLIDE_IMAGE_WIDTH,
        EvenHubService.SLIDE_IMAGE_HEIGHT,
      );
      const blankData = EvenHubService.imageDataForBridge(blankBmp);

      // Hide in sequence: top-right, top-left, bottom-right, bottom-left
      for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
        const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
        const res = await this.bridge.updateImageRawData({
          containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
          containerName:
            EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
          imageData: blankData,
        });
        const ok =
          res === ImageRawDataUpdateResult.success ||
          (typeof res === "string" && res === "success") ||
          res === 0;
        if (!ok) {
          logger.deviceError("Failed to hide quadrant image", {
            quadrant: quadrantIdx + 1,
            result: res,
          });
          return false;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      logger.deviceSuccess("All 4 quadrant images hidden on glasses");
      return true;
    } catch (error) {
      logger.deviceError("Failed to toggle image visibility", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Display timer on glasses. Timer runs in app UI only; 4-quadrant layout has no timer container.
   */
  async displayTimer(seconds: number): Promise<boolean> {
    if (!this.bridge) {
      logger.deviceError("Cannot display timer - bridge not initialized");
      return false;
    }
    try {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      logger.device("Timer (app UI)", {
        timerText: `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      });
      return true;
    } catch (error) {
      logger.deviceError("Failed to display timer", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Start listening to EvenHub events
   */
  startEventListening() {
    if (!this.bridge) {
      logger.deviceError(
        "Cannot start event listening - bridge not initialized",
      );
      return;
    }

    if (this.eventUnsubscribe) {
      logger.device("Event listener already active, skipping");
      return;
    }

    logger.device("Registering EvenHub event listener...");
    this.eventUnsubscribe = this.bridge.onEvenHubEvent(
      (event: EvenHubEvent) => {
        // Log full raw event (all ring/device events) for debugging
        try {
          const rawJson = JSON.stringify(event, null, 2);
          logger.device("📱 RING/DEVICE EVENT (full raw)", { raw: rawJson });
        } catch (e) {
          logger.device("📱 RING/DEVICE EVENT (full raw)", {
            raw: String(event),
            keys: event && typeof event === "object" ? Object.keys(event) : [],
          });
        }

        const sysEventType = event.sysEvent?.eventType;
        const sysEventTypeName =
          sysEventType !== undefined
            ? Object.keys(OsEventTypeList).find(
                (key) =>
                  OsEventTypeList[key as keyof typeof OsEventTypeList] ===
                  sysEventType,
              ) || `UNKNOWN(${sysEventType})`
            : null;

        logger.device("📱 Event summary", {
          hasSysEvent: !!event.sysEvent,
          hasTextEvent: !!event.textEvent,
          hasListEvent: !!event.listEvent,
          hasAudioEvent: !!(event as any).audioEvent,
          sysEventType,
          sysEventTypeName,
          sysEventRaw: event.sysEvent,
          textEvent: event.textEvent
            ? {
                containerID: event.textEvent.containerID,
                containerName: event.textEvent.containerName,
                eventType: event.textEvent.eventType,
              }
            : null,
          listEvent: event.listEvent
            ? {
                containerID: event.listEvent.containerID,
                eventType: event.listEvent.eventType,
              }
            : null,
        });

        const getEventTypeNum = (
          raw: Record<string, unknown> | undefined,
        ): number | null => {
          if (!raw) return null;
          const eventTypeRaw = raw.eventType ?? (raw as any).event_type;
          const et =
            typeof eventTypeRaw === "number"
              ? eventTypeRaw
              : Number(eventTypeRaw);
          return Number.isFinite(et) ? Math.floor(et) : null;
        };

        // if (
        //   this.presentationSlideModeActive &&
        //   !this.rtpSlideMode &&
        //   this.isDoubleTapFromEvent(event)
        // ) {
        //   logger.device(
        //     "Presentation double-tap: toggling temporary hide/show",
        //   );
        //   this.toggleTemporaryPresentationVisibility().catch((err) =>
        //     logger.deviceError(
        //       "Failed to toggle temporary presentation visibility",
        //       {
        //         error: err instanceof Error ? err.message : String(err),
        //       },
        //     ),
        //   );
        //   return;
        // }

        if (event.sysEvent?.imuData && this.onImuDataCallback) {
          const x = Number(event.sysEvent.imuData.x ?? 0);
          const y = Number(event.sysEvent.imuData.y ?? 0);
          const z = Number(event.sysEvent.imuData.z ?? 0);
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            this.onImuDataCallback({ x, y, z });
          }
        }

        // Real Text Prompter slide mode: scroll up / tap = next slide, scroll down = prev, double-tap = back to list
        if (this.rtpSlideMode && this.rtpSlides.length > 0 && this.bridge) {
          const sysNum = getEventTypeNum(
            event.sysEvent as unknown as Record<string, unknown> | undefined,
          );
          const textNum = getEventTypeNum(
            event.textEvent as unknown as Record<string, unknown> | undefined,
          );
          const et = sysNum ?? textNum;
          if (et === OsEventTypeList.DOUBLE_CLICK_EVENT || et === 3) {
            logger.device("RTP slide mode: double-tap → back to list");
            this.rtpSlideMode = false;
            this.rtpSlides = [];
            this.rtpSlideIndex = 0;
            this.rtpRebuildAndFocusList("— בחר פריט מהרשימה —").catch(() => {});
            return;
          }
          if (
            et === OsEventTypeList.SCROLL_TOP_EVENT ||
            // et === OsEventTypeList.CLICK_EVENT ||
            // et === 0 ||
            et === 1
          ) {
            const nextIndex = Math.min(
              this.rtpSlideIndex + 1,
              this.rtpSlides.length - 1,
            );
            if (nextIndex !== this.rtpSlideIndex) {
              this.rtpSlideIndex = nextIndex;
              logger.device("RTP slide mode: next", {
                index: this.rtpSlideIndex,
                total: this.rtpSlides.length,
              });
              this.rtpUpdateSlideImage(
                this.rtpSlides[this.rtpSlideIndex],
              ).catch(() => {});
            }
            return;
          }
          if (et === OsEventTypeList.SCROLL_BOTTOM_EVENT || et === 2) {
            const prevIndex = Math.max(0, this.rtpSlideIndex - 1);
            if (prevIndex !== this.rtpSlideIndex) {
              this.rtpSlideIndex = prevIndex;
              logger.device("RTP slide mode: prev", {
                index: this.rtpSlideIndex,
                total: this.rtpSlides.length,
              });
              this.rtpUpdateSlideImage(
                this.rtpSlides[this.rtpSlideIndex],
              ).catch(() => {});
            }
            return;
          }
        }

        // Real Text Prompter: double-tap (when text has focus) = back to list to choose different item
        if (
          this.rtpTextFocusActive &&
          this.rtpBlocks &&
          this.rtpBlocks.length > 0 &&
          this.bridge
        ) {
          const isDoubleTap = (raw: Record<string, unknown>) => {
            const eventTypeRaw = raw.eventType ?? (raw as any).event_type;
            const et =
              typeof eventTypeRaw === "number"
                ? eventTypeRaw
                : Number(eventTypeRaw);
            return et === OsEventTypeList.DOUBLE_CLICK_EVENT || et === 3;
          };
          if (
            event.textEvent &&
            isDoubleTap(event.textEvent as unknown as Record<string, unknown>)
          ) {
            logger.device("RTP text double-tap → back to list");
            this.rtpTextFocusActive = false;
            this.rtpRebuildAndFocusList("— בחר פריט מהרשימה —").catch(() => {});
            return;
          }
          if (
            event.sysEvent &&
            isDoubleTap(event.sysEvent as unknown as Record<string, unknown>)
          ) {
            logger.device("RTP ring double-tap → back to list");
            this.rtpTextFocusActive = false;
            this.rtpRebuildAndFocusList("— בחר פריט מהרשימה —").catch(() => {});
            return;
          }
        }

        // Real Text Prompter: list tap = split content by double newline → slides as BMP; scroll/tap = next/prev, double-tap = back to list
        if (
          event.listEvent &&
          this.rtpBlocks &&
          this.rtpBlocks.length > 0 &&
          this.bridge
        ) {
          const raw = event.listEvent as unknown as Record<string, unknown>;
          const idxNum =
            typeof raw.currentSelectItemIndex === "number"
              ? raw.currentSelectItemIndex
              : typeof (raw as any).current_select_item_index === "number"
                ? (raw as any).current_select_item_index
                : Number(
                    raw.currentSelectItemIndex ??
                      (raw as any).current_select_item_index,
                  );
          const idx = Number.isFinite(idxNum) ? Math.floor(idxNum) : 0;
          const safeIdx = Math.max(0, Math.min(idx, this.rtpBlocks.length - 1));
          const content = this.rtpBlocks[safeIdx]?.content ?? "";
          const slides = content
            .split(/\n\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const rtpSlides = slides.length > 0 ? slides : [content || " "];
          this.rtpSlideMode = true;
          this.rtpSlides = rtpSlides;
          this.rtpSlideIndex = 0;
          logger.device("RTP list tap → slide mode (BMP)", {
            safeIdx,
            slideCount: rtpSlides.length,
          });
          this.rtpRebuildToFourQuadrantsAndShowSlide(rtpSlides[0]).catch(
            (err) =>
              logger.deviceError("RTP slide mode start failed", { error: err }),
          );
          return;
        }

        if (this.onEventCallback) {
          this.onEventCallback(event);
        } else {
          logger.device("⚠️ No event callback registered - event ignored");
        }
      },
    );
    logger.deviceSuccess("Event listener registered successfully");
  }

  private onEventCallback: ((event: EvenHubEvent) => void) | null = null;

  /**
   * Set callback for handling events
   */
  setEventCallback(callback: (event: EvenHubEvent) => void) {
    this.onEventCallback = callback;
  }

  /**
   * Build RTP list + text containers. listHasCapture: true = list gets tap (choose item), false = text gets tap/scroll.
   */
  private rtpBuildContainer(
    listHasCapture: boolean,
    textContent: string,
  ): RebuildPageContainer {
    if (!this.rtpBlocks || this.rtpBlocks.length === 0) {
      throw new Error("rtpBlocks required");
    }
    const itemNames = this.rtpBlocks.map((b) => {
      const s = (b.title ?? b.content ?? " ").trim() || " ";
      return s.length > EvenHubService.RTP_ITEM_NAME_MAX
        ? s.slice(0, EvenHubService.RTP_ITEM_NAME_MAX - 3) + "..."
        : s;
    });
    const listContainer = new ListContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 260,
      height: CANVAS_HEIGHT,
      containerID: EvenHubService.RTP_LIST_CONTAINER_ID,
      containerName: EvenHubService.RTP_LIST_CONTAINER_NAME,
      itemContainer: new ListItemContainerProperty({
        itemCount: itemNames.length,
        itemWidth: 0,
        isItemSelectBorderEn: 1,
        itemName: itemNames,
      }),
      isEventCapture: listHasCapture ? 1 : 0,
    });
    const textContainer = new TextContainerProperty({
      xPosition: 264,
      yPosition: 0,
      width: CANVAS_WIDTH - 264,
      height: CANVAS_HEIGHT,
      containerID: EvenHubService.RTP_TEXT_CONTAINER_ID,
      containerName: EvenHubService.RTP_TEXT_CONTAINER_NAME,
      content: textContent,
      isEventCapture: listHasCapture ? 0 : 1,
    });
    return new RebuildPageContainer({
      containerTotalNum: 2,
      listObject: [listContainer],
      textObject: [textContainer],
    });
  }

  /** Rebuild so list has event capture; show placeholder. Use when user double-taps to go back to list. */
  private async rtpRebuildAndFocusList(textContent: string): Promise<void> {
    if (!this.bridge || !this.rtpBlocks?.length) return;
    const container = this.rtpBuildContainer(true, textContent);
    const ok = await this.bridge.rebuildPageContainer(container);
    if (ok) logger.deviceSuccess("RTP back to list");
    else logger.deviceError("RTP rebuild for list focus failed");
  }

  /** Rebuild to full-screen text only (list hidden). Use after list tap; double-tap restores list. */
  // private async rtpRebuildFullScreenText(textContent: string): Promise<void> {
  //   if (!this.bridge || !this.rtpBlocks?.length) return;
  //   const textContainer = new TextContainerProperty({
  //     xPosition: 0,
  //     yPosition: 0,
  //     width: CANVAS_WIDTH,
  //     height: CANVAS_HEIGHT,
  //     containerID: EvenHubService.RTP_TEXT_CONTAINER_ID,
  //     containerName: EvenHubService.RTP_TEXT_CONTAINER_NAME,
  //     content: textContent,
  //     isEventCapture: 1,
  //   });
  //   const container = new RebuildPageContainer({
  //     containerTotalNum: 1,
  //     textObject: [textContainer],
  //     listObject: [],
  //   });
  //   const ok = await this.bridge.rebuildPageContainer(container);
  //   if (ok) logger.deviceSuccess("RTP full-screen text (list hidden)");
  //   else logger.deviceError("RTP rebuild full-screen text failed");
  // }

  /** RTP slide mode: rebuild page to 4 quadrants and show one slide as BMP. */
  private async rtpRebuildToFourQuadrantsAndShowSlide(
    slideContent: string,
  ): Promise<boolean> {
    if (!this.bridge) return false;
    const style: TextStyle = { ...DEFAULT_TEXT_STYLE };
    const content = (slideContent || " ").trim();
    const [q1, q2, q3, q4] = renderParagraphToFourQuadrants(content, style);
    const imagesToSend = [q1, q2, q3, q4];
    const imageContainers = EvenHubService.getFourQuadrantImageContainers();
    const container = new RebuildPageContainer({
      containerTotalNum: 4,
      imageObject: imageContainers,
      listObject: [],
      textObject: [],
    });
    const ok = await this.bridge.rebuildPageContainer(container);
    if (!ok) {
      logger.deviceError("RTP rebuild to 4 quadrants failed");
      return false;
    }
    await new Promise((r) => setTimeout(r, 150));
    for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
      const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
      const updateResult = await this.bridge.updateImageRawData({
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
        imageData: EvenHubService.imageDataForBridge(imagesToSend[quadrantIdx]),
      });
      const isOk =
        updateResult === ImageRawDataUpdateResult.success ||
        (typeof updateResult === "string" && updateResult === "success") ||
        updateResult === 0;
      if (!isOk) {
        logger.deviceError("RTP failed to update quadrant image", {
          quadrant: quadrantIdx + 1,
        });
        return false;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    logger.deviceSuccess("RTP slide mode: showing slide as BMP");
    return true;
  }

  /** RTP slide mode: update only the 4 quadrant images (page already has 4 quadrants). */
  private async rtpUpdateSlideImage(slideContent: string): Promise<boolean> {
    if (!this.bridge) return false;
    const style: TextStyle = { ...DEFAULT_TEXT_STYLE };
    const content = (slideContent || " ").trim();
    const [q1, q2, q3, q4] = renderParagraphToFourQuadrants(content, style);
    const imagesToSend = [q1, q2, q3, q4];
    for (let orderIdx = 0; orderIdx < 4; orderIdx++) {
      const quadrantIdx = EvenHubService.QUADRANT_LOAD_ORDER[orderIdx];
      const updateResult = await this.bridge.updateImageRawData({
        containerID: EvenHubService.SLIDE_IMAGE_CONTAINER_IDS[quadrantIdx],
        containerName: EvenHubService.SLIDE_IMAGE_CONTAINER_NAMES[quadrantIdx],
        imageData: EvenHubService.imageDataForBridge(imagesToSend[quadrantIdx]),
      });
      const isOk =
        updateResult === ImageRawDataUpdateResult.success ||
        (typeof updateResult === "string" && updateResult === "success") ||
        updateResult === 0;
      if (!isOk) return false;
      await new Promise((r) => setTimeout(r, 80));
    }
    return true;
  }

  /**
   * Start Real Text Prompter presentation: show list of blocks on glasses; tap updates text.
   * Uses rebuildPageContainer (list + text). List events update the text container.
   */
  async startRtpPresentation(
    blocks: { title?: string; content: string }[],
  ): Promise<boolean> {
    if (!this.bridge) {
      logger.deviceError("Cannot start RTP - bridge not initialized");
      return false;
    }
    if (blocks.length === 0) {
      logger.deviceError("Cannot start RTP - no blocks");
      return false;
    }
    const itemNames = blocks.map((b) => {
      const s = (b.title ?? b.content ?? " ").trim() || " ";
      return s.length > EvenHubService.RTP_ITEM_NAME_MAX
        ? s.slice(0, EvenHubService.RTP_ITEM_NAME_MAX - 3) + "..."
        : s;
    });
    const initialPrompt = "— בחר פריט מהרשימה —";

    try {
      const listContainer = new ListContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: 260,
        height: CANVAS_HEIGHT,
        containerID: EvenHubService.RTP_LIST_CONTAINER_ID,
        containerName: EvenHubService.RTP_LIST_CONTAINER_NAME,
        itemContainer: new ListItemContainerProperty({
          itemCount: itemNames.length,
          itemWidth: 0,
          isItemSelectBorderEn: 1,
          itemName: itemNames,
        }),
        isEventCapture: 1,
      });
      const textContainer = new TextContainerProperty({
        xPosition: 264,
        yPosition: 0,
        width: CANVAS_WIDTH - 264,
        height: CANVAS_HEIGHT,
        containerID: EvenHubService.RTP_TEXT_CONTAINER_ID,
        containerName: EvenHubService.RTP_TEXT_CONTAINER_NAME,
        content: initialPrompt,
        isEventCapture: 0,
      });
      const containerPayload = {
        containerTotalNum: 2,
        listObject: [listContainer],
        textObject: [textContainer],
      };

      let success: boolean;
      const useCreate = !this.startupPageCreated;
      if (useCreate) {
        logger.device("RTP: creating glasses UI (createStartUpPageContainer)");
        const result = await this.bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer(containerPayload),
        );
        success =
          result === StartUpPageCreateResult.success ||
          result === 0 ||
          result === true;
        if (success) this.startupPageCreated = true;
      } else {
        logger.device("RTP: rebuilding glasses UI (rebuildPageContainer)");
        success = await this.bridge.rebuildPageContainer(
          new RebuildPageContainer(containerPayload),
        );
      }

      if (success) {
        this.rtpBlocks = blocks;
        logger.deviceSuccess("RTP presentation started on glasses", {
          blockCount: blocks.length,
          usedCreate: useCreate,
        });
      } else {
        logger.deviceError("RTP page container call returned false");
      }
      return success;
    } catch (error) {
      logger.deviceError("RTP start failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Stop Real Text Prompter presentation and clear glasses UI.
   */
  async stopRtpPresentation(): Promise<boolean> {
    this.rtpBlocks = null;
    this.rtpTextFocusActive = false;
    this.rtpSlideMode = false;
    this.rtpSlides = [];
    this.rtpSlideIndex = 0;
    this.presentationSlideModeActive = false;
    this.presentationTemporarilyHidden = false;
    this.lastPresentationQuadrants = null;
    await this.disableImu();
    if (!this.bridge) return true;
    try {
      const success = await this.bridge.shutDownPageContainer(0);
      if (success) {
        this.startupPageCreated = false;
        logger.deviceSuccess("RTP presentation finished");
      } else {
        logger.deviceError("RTP shutDownPageContainer returned false");
      }
      return success;
    } catch (error) {
      logger.deviceError("RTP stop failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Shut down the page container
   */
  async shutdown(): Promise<boolean> {
    if (!this.bridge) {
      logger.deviceError("Cannot shutdown - bridge not initialized");
      return false;
    }

    try {
      this.presentationSlideModeActive = false;
      this.presentationTemporarilyHidden = false;
      this.lastPresentationQuadrants = null;
      await this.disableImu();
      logger.device("Shutting down container on glasses...");
      const success = await this.bridge.shutDownPageContainer(0);
      if (success) {
        this.startupPageCreated = false;
        logger.deviceSuccess("Container shutdown successfully");
      } else {
        logger.deviceError("Container shutdown returned false");
      }
      return success;
    } catch (error) {
      logger.deviceError("Failed to shutdown container", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    logger.device("Cleaning up event listeners...");
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
      this.eventUnsubscribe = null;
      logger.deviceSuccess("Event listener unsubscribed");
    }
    if (this.launchSourceUnsubscribe) {
      this.launchSourceUnsubscribe();
      this.launchSourceUnsubscribe = null;
    }
    this.onEventCallback = null;
    this.onImuDataCallback = null;
    this.imuEnabled = false;
    this.presentationSlideModeActive = false;
    this.presentationTemporarilyHidden = false;
    this.lastPresentationQuadrants = null;
  }
}

export const evenHubService = new EvenHubService();
