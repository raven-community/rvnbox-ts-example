import RVNBOXSDK from 'rvnbox-sdk/lib/rvnbox-sdk';
let RVNBOX = new RVNBOXSDK();

import { AddressDetailsResult } from './node_modules/rvnbox-sdk/lib/Address';

let langs = [
  'english',
  'chinese_simplified',
  'chinese_traditional',
  'korean',
  'japanese',
  'french',
  'italian',
  'spanish'
]

async function testAsyncFunction(): Promise<void> {
  console.log("Test async address details:")
  let details = <AddressDetailsResult> await RVNBOX.Address.details("qzjhzmheyyyt3sjv5qwvxq0wmweun5jfzsrca5hc9y");
  console.log(details);

  console.log("Test Price: Current Ravencoin Prices:")
  console.log(await RVNBOX.Price.current());

  // console.log("Test Real-time sockets:");
  // let socket = new RVNBOX.Socket();
  // socket.listen("transactions",  (message: any) => {
  //   console.log(message);
  // });
}

testAsyncFunction();

let lang = langs[Math.floor(Math.random()*langs.length)];

// create 256 bit BIP39 mnemonic
let mnemonic = RVNBOX.Mnemonic.generate(256, RVNBOX.Mnemonic.wordLists()[lang])
console.log("BIP44 $RVN Wallet");
console.log(`256 bit ${lang} BIP39 Mnemonic: `, mnemonic);

// root seed buffer
let rootSeed = RVNBOX.Mnemonic.toSeed(mnemonic)

// master HDNode
let masterHDNode = RVNBOX.HDNode.fromSeed(rootSeed)

// HDNode of BIP44 account
let account = RVNBOX.HDNode.derivePath(masterHDNode, "m/44'/175'/0'");
console.log(`BIP44 Account: "m/44'/175'/0'"`);

for(let i = 0; i < 10; i++) {
  let childNode = masterHDNode.derivePath(`m/44'/175'/0'/0/${i}`);
  console.log(`m/44'/175'/0'/0/${i}: ${RVNBOX.HDNode.toLegacyAddress(childNode)}`);
}

// derive the first external change address HDNode which is going to spend utxo
let change = RVNBOX.HDNode.derivePath(account, "0/0");

// get the address
let legacyAddress = RVNBOX.HDNode.toLegacyAddress(change);

let hex;

RVNBOX.Address.utxo(legacyAddress).then((result) => {
  if(!result[0]) {
    return;
  }

  // instance of transaction builder
  let transactionBuilder = new RVNBOX.TransactionBuilder('testnet');
  // original amount of satoshis in vin
  let originalAmount = result[0].satoshis;

  // index of vout
  let vout = result[0].vout;

  // txid of vout
  let txid = result[0].txid;

  // add input with txid and index of vout
  transactionBuilder.addInput(txid, vout);

  // get byte count to calculate fee. paying 1 sat/byte
  let byteCount = RVNBOX.RavenCoin.getByteCount({ P2PKH: 1 }, { P2PKH: 1 });
  // 192
  // amount to send to receiver. It's the original amount - 1 satoshi/byte for tx size
  let sendAmount = originalAmount - byteCount;

  // add output w/ address and amount to send
  transactionBuilder.addOutput(legacyAddress, sendAmount);

  // keypair
  let keyPair = RVNBOX.HDNode.toKeyPair(change);

  // sign w/ HDNode
  let redeemScript;
  transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

  // build tx
  let tx = transactionBuilder.build();
  // output rawhex
  let hex = tx.toHex();
  console.log(`Transaction raw hex: ${hex}`);

  // sendRawTransaction to running RVN node
  RVNBOX.RawTransactions.sendRawTransaction(hex).then((result) => {
    console.log(`Transaction ID: ${result}`);
  }, (err) => {
    console.log(err);
  });
}, (err) => {
  console.log(err);
});
