import {
  RemoteDataStream,
  SkyWayAuthToken,
  SkyWayChannel,
  SkyWayContext,
  SkyWayStreamFactory,
  uuidV4,
} from "@skyway-sdk/core";
import { SfuBotMember, SfuClientPlugin } from "@skyway-sdk/sfu-client";

const appId = "76394876-71d4-4327-96a8-5f262a23715c";
const secretKey = "SCOQ1l5swgLkKXMednmNaSmqGjq5/KA6+oe2PqLCwSg=";

const testToken = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
  scope: {
    app: {
      id: appId,
      turn: true,
      actions: ["read"],
      channels: [
        {
          id: "*",
          name: "*",
          actions: ["write"],
          members: [
            {
              id: "*",
              name: "*",
              actions: ["write"],
              publication: {
                actions: ["write"],
              },
              subscription: {
                actions: ["write"],
              },
            },
          ],
          sfuBots: [
            {
              actions: ["write"],
              forwardings: [{ actions: ["write"] }],
            },
          ],
        },
      ],
    },
  },
});
const tokenString = testToken.encode(secretKey);

async function main() {
  const localVideo = document.getElementById("js-local-stream");
  const joinTrigger = document.getElementById("js-join-trigger");
  const leaveTrigger = document.getElementById("js-leave-trigger");
  const remoteVideos = document.getElementById("js-remote-streams");
  const roomId = document.getElementById("js-room-id");

  const { audio, video } =
    await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();

  // Render local stream
  localVideo.muted = true;
  localVideo.playsInline = true;
  video.attach(localVideo);
  await localVideo.play().catch(console.error);

  const context = await SkyWayContext.Create(tokenString, {
    log: { level: "debug" },
  });
  const plugin = new SfuClientPlugin();
  context.registerPlugin(plugin);

  // Register join handler
  joinTrigger.addEventListener("click", async () => {
    const channel = await SkyWayChannel.FindOrCreate(context, {
      name: roomId.value,
    });
    const member = await channel.join({});

    let bot = channel.bots.find((b) => b.subtype === SfuBotMember.subtype);
    if (!bot) {
      bot = await plugin.createBot(channel);
    }

    const userVideo = {};

    member.onStreamSubscribed.add(async ({ stream, subscription }) => {
      if (stream instanceof RemoteDataStream) {
        return;
      }

      const publisherId = subscription.publication.origin.publisher.id;
      if (!userVideo[publisherId]) {
        const newVideo = document.createElement("video");
        newVideo.playsInline = true;
        // mark peerId to find it later at peerLeave event
        newVideo.setAttribute(
          "data-member-id",
          subscription.publication.publisher.id
        );
        newVideo.autoplay = true;
        remoteVideos.append(newVideo);
        userVideo[publisherId] = newVideo;
      }

      const newVideo = userVideo[publisherId];
      stream.attach(newVideo);
    });
    const subscribe = async (publication) => {
      if (publication.origin && publication.origin.publisher.id !== member.id) {
        await member.subscribe(publication.id);
      }
    };
    channel.onStreamPublished.add(async (e) => {
      await subscribe(e.publication);
    });
    channel.publications.forEach(async (p) => {
      await subscribe(p);
    });

    {
      const publication = await member.publish(video);
      await bot.startForwarding(publication);
    }
    {
      const publication = await member.publish(audio);
      await bot.startForwarding(publication);
    }

    channel.onMemberLeft.add((e) => {
      if (e.member.id === member.id) return;

      const remoteVideo = remoteVideos.querySelector(
        `[data-member-id="${e.member.id}"]`
      );
      const stream = remoteVideo.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();
    });

    member.onLeft.once(() => {
      Array.from(remoteVideos.children).forEach((element) => {
        const remoteVideo = element;
        const stream = remoteVideo.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
      channel.dispose();
    });

    leaveTrigger.addEventListener(
      "click",
      async () => {
        await member.leave();
      },
      {
        once: true,
      }
    );
  });
}

main();
