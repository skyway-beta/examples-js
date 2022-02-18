import {
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayMediaDevices,
  SkyWayChannel,
  uuidV4,
} from '@skyway-sdk/core';

const appId = '<YOUR APP ID>';
const secretKey = '<YOUR SECRET KEY>';

const testToken = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
  scope: {
    app: {
      id: appId,
      turn: true,
      actions: ['read'],
      channels: [
        {
          id: '*',
          name: '*',
          actions: ['write'],
          members: [
            {
              id: '*',
              name: '*',
              actions: ['write'],
              publication: {
                actions: ['write'],
              },
              subscription: {
                actions: ['write'],
              },
            },
          ],
        },
      ],
    },
  },
});
const tokenString = testToken.encode(secretKey);

async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomName = document.getElementById('js-channel-id');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');

  const { audio, video } =
    await SkyWayMediaDevices.createMicrophoneAudioAndCameraStream();
  const data = await SkyWayMediaDevices.createDataStream();

  // Render local stream
  localVideo.muted = true;
  localVideo.playsInline = true;
  video.attach(localVideo);
  await localVideo.play().catch(console.error);

  const context = await SkyWayContext.Create(tokenString, {
    logLevel: 'debug',
  });

  // Register join handler
  joinTrigger.addEventListener('click', async () => {
    const channel = await SkyWayChannel.FindOrCreate(context, {
      name: roomName.value
    });
    messages.textContent += '=== You joined ===\n';
    const member = await channel.join();
    messages.textContent += `=== ${member.id} joined ===\n`;

    const userVideo = {};

    member.onStreamSubscribed.add(async ({ stream, subscription }) => {
      if (stream.contentType === 'data') {
        stream.onData.add((data) => {
          const { message } = data;
          messages.textContent += `${subscription.publication.publisher.id}: ${message}\n`;
        });
        return;
      }

      const publisherId = subscription.publication.publisher.id;
      if (!userVideo[publisherId]) {
        const newVideo = document.createElement('video');
        newVideo.playsInline = true;
        newVideo.setAttribute(
          'data-member-id',
          subscription.publication.publisher.id
        );
        newVideo.autoplay = true;
        remoteVideos.append(newVideo);
        userVideo[publisherId] = newVideo;
      }

      const newVideo = userVideo[publisherId];
      stream.attach(newVideo);
    });
    channel.onStreamPublished.add(async (e) => {
      if (e.publication.publisher.id === member.id) return;
      await member.subscribe(e.publication.id);
    });
    channel.publications.forEach(async (p) => {
      if (p.publisher.id === member.id) return;
      await member.subscribe(p.id);
    });

    await member.publish(audio);
    await member.publish(video);
    await member.publish(data);

    channel.onMemberLeft.add((e) => {
      if (e.member.id === member.id) return;

      const remoteVideo = remoteVideos.querySelector(
        `[data-member-id="${e.member.id}"]`
      );
      const stream = remoteVideo.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${e.member.id} left ===\n`;
    });

    member.onLeft.once(() => {
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach((element) => {
        const remoteVideo = element;
        const stream = remoteVideo.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
      channel.dispose();
    });

    sendTrigger.addEventListener('click', () => {
      data.write({ message: localText.value });
      messages.textContent += `${member.id}: ${localText.value}\n`;
      localText.value = '';
    });
    leaveTrigger.addEventListener(
      'click',
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
