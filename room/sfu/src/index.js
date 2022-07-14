import {
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayRoom,
  SkyWayStreamFactory,
  uuidV4,
} from "@skyway-sdk/room";

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
  const roomName = document.getElementById("js-room-id");

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

  // Register join handler
  joinTrigger.addEventListener("click", async () => {
    const room = await SkyWayRoom.FindOrCreate(context, {
      name: roomName.value,
      type: "sfu",
    });
    const member = await room.join();

    const userVideo = {};

    member.onStreamSubscribed.add(async ({ stream, subscription }) => {
      const publisherId = subscription.publication.publisher.id;
      if (!userVideo[publisherId]) {
        const newVideo = document.createElement("video");
        newVideo.playsInline = true;
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
      if (publication.publisher.id === member.id) return;
      await member.subscribe(publication.id);
    };
    room.onStreamPublished.add(async (e) => {
      await subscribe(e.publication);
    });
    room.publications.forEach(async (p) => {
      await subscribe(p);
    });

    await member.publish(audio);
    await member.publish(video);

    room.onMemberLeft.add((e) => {
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
      room.dispose();
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
