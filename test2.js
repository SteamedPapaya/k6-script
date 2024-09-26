import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const latencyTrend_ms = new Trend('latency_ms');

export const options = {
  vus: 200,          // VU 수를 200명으로 설정
  duration: '30s',   // 테스트 기간을 30초로 설정
};

export default function () {
  const url = 'ws://localhost:8080/chat';  // WebSocket 서버 URL
  const sender = 'user_' + __VU;
  const maxMessages = 10;  // 각 VU가 보낼 메시지 수

  const res = ws.connect(url, {}, function (socket) {
    let messageCount = 0;

    socket.on('open', function () {
      console.log('WebSocket 연결 성공');
      // 메시지 전송 시작
      sendMessages(socket);
    });

    socket.on('message', function (message) {
      try {
        const receivedMessage = JSON.parse(message);
        const latency = Date.now() - receivedMessage.sentTime;

        console.log(`서버로부터 메시지 수신 ID: ${receivedMessage.messageId} Latency: ${latency}ms`);

        check(receivedMessage, { '메시지 수신 여부': (msg) => msg.content !== '' });
        latencyTrend_ms.add(latency);
      } catch (e) {
        console.error(`메시지 파싱 오류: ${e.message}`);
      }
    });

    socket.on('close', function () {
      console.log('WebSocket 연결 종료');
    });

    socket.on('error', function (e) {
      console.log('WebSocket 에러: ' + e.error());
    });

    function sendMessages(socket) {
      let intervalId = setInterval(() => {
        if (messageCount < maxMessages) {
          const messageId = `${__VU}-${messageCount}-${Date.now()}`;
          const sentTime = Date.now();

          const message = JSON.stringify({
            sender: sender,
            content: `Message ${messageCount} from ${sender}`,
            messageId: messageId,
            sentTime: sentTime,
          });

          socket.send(message);
          console.log(`메시지 전송: ${message} | Count: ${messageCount}`);
          messageCount++;
        } else {
          clearInterval(intervalId);
          console.log(`${sender} 모든 메시지 전송 완료`);

          // 5초 후 연결 종료
          setTimeout(() => {
            socket.close();
          }, 5000);
        }
      }, Math.random() * 2000 + 1000);  // 1~3초 간격으로 메시지 전송
    }
  });

  check(res, { '연결 성공': (r) => r && r.status === 101 });
}