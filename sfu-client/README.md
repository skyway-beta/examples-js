# SFU Client example

## 使い方

1. `index.js`上の`<YOUR APP ID>`と`<YOUR SECRET KEY>`を自身のアプリケーションID、シークレットキーに置換する

**WARNING**

本サンプルアプリでは、すぐに通信を試していただくために、トークン生成をフロントエンドで実装していますが、 本来は、SkyWay Auth Token はサーバーアプリケーションで生成して client アプリケーションに対して渡すようにするべきです。 SkyWay Auth Token 生成に必要なシークレットキーが流出した場合、誰でも任意の Channel/Room に入ることができるなどのセキュリティ上の問題が発生します。

2. `npx webpack`を実行し、`public/main.js`を生成

3. webサーバーを起動し、`public/index.html`をブラウザで表示
