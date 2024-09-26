import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const latencyTrend_ms = new Trend('latency_ms');

// export const options = {
//     vus: 1000,
//     duration: '20s',
// };

export const options = {
  stages: [
    { duration: '20s', target: 1000 },
    // { duration: '20s', target: 1000 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const url = 'ws://localhost:8080/chat';  // WebSocket 서버 URL
  const totalMessages = 10;
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      console.log('WebSocket 연결 성공');
    //   for (let i = 1; i <= totalMessages; i++) {
        const sender = 'user_' + __VU;
        const messageId = `${__VU}-${__ITER}-${Date.now()}`;
        const sentTime = Date.now();
  
        const message = JSON.stringify({
          sender: sender,
          content: `Message from ${sender}`,
          messageId: messageId,
          sentTime: sentTime,
        });
  
        socket.send(message);
        console.log(`메시지 전송: ${message}`);
    //   }
    });

    socket.on('message', function (message) {
      try {
        const receivedMessage = JSON.parse(message);
        const latency = Date.now() - receivedMessage.sentTime;

        console.log(`서버로부터 메시지 수신 ID: ${receivedMessage.messageId} Latency: ${latency}ms`);

        check(receivedMessage, { '메시지 수신 여부': (msg) => msg.content !== '' });

        // 지연 시간을 Trend 메트릭에 기록
        latencyTrend_ms.add(latency);

        // 메시지 수신 후 연결 종료
        socket.close();
      } catch (e) {
        console.error(`메시지 파싱 오류: ${e.message}`);
      }
    });

    socket.on('close', function () {
        sleep(30);
      console.log('WebSocket 연결 종료');
    });

    socket.on('error', function (e) {
      console.log('WebSocket 에러: ' + e.error());
    });

    // 테스트 기간 내에 연결 종료를 보장하기 위해 타임아웃 설정을 테스트 기간보다 짧게 설정
    socket.setTimeout(function () {
      console.log('타임아웃, 연결 종료');
      socket.close();
    }, 30 * 1000);  // 10초 후 연결 종료
  });

  check(res, { '연결 성공': (r) => r && r.status === 101 });
}