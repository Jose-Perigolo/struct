"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const node_assert_1 = require("node:assert");
const struct_1 = require("../dist/struct");
const TESTSPEC = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', '..', 'build/test/test.json'), 'utf8'));
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function testset(tests, apply) {
    for (let entry of tests.set) {
        (0, node_assert_1.deepEqual)(apply(entry.in), entry.out);
    }
}
(0, node_test_1.describe)('struct', () => {
    (0, node_test_1.test)('merge-exists', () => {
        (0, node_assert_1.equal)('function', typeof struct_1.merge);
    });
    (0, node_test_1.test)('merge-basic', () => {
        const test = clone(TESTSPEC.merge.basic);
        (0, node_assert_1.deepEqual)((0, struct_1.merge)(test.in), test.out);
    });
    (0, node_test_1.test)('merge-children', () => {
        const test = clone(TESTSPEC.merge.children);
        (0, node_assert_1.deepEqual)((0, struct_1.merge)(test.in), test.out);
    });
    (0, node_test_1.test)('merge-array', () => {
        testset(clone(TESTSPEC.merge.array), struct_1.merge);
    });
    (0, node_test_1.test)('walk-exists', () => {
        (0, node_assert_1.equal)('function', typeof struct_1.merge);
    });
    (0, node_test_1.test)('walk-basic', () => {
        testset(clone(TESTSPEC.walk.basic), (vin) => (0, struct_1.walk)(vin, walkpath));
    });
    // test('transform', async ()=>{
    //   // deepEqual(transform({a:1},{a:'`a`'}), {a:1})
    //   const src = {
    //     a: 1,
    //     c: {x:'X',y:'Y'},
    //     d: 'D',
    //     e: 2,
    //     f: {m:'M',n:'N'},
    //     ff: {m:'MM',l:'LL'},
    //     x: {x0:{y:0}, x1:{y:1}},
    //     y:[{k:'x0',x:0},{k:'x1',x:1}]
    //   }
    //   const pat = {
    //     a:'`$COPY`',
    //     aa:'`a`',
    //     b: 'B',
    //     q: '<`a``d`>',
    //     '`d`': '`c`',
    //     e: '`$DELETE`',
    //     o:{p:'`$KEY`'},
    //     '`$MERGE`': ['`f`','`ff`'],
    //     g: { '`$MERGE`': '`f`' },
    //     '`$EACH`x': {z:'Z', y:'`$COPY`',k:'`$KEY`'},
    //     '`$PACK`y': {z:'Z', x:'`$COPY`','`$KEY`':'k',i:'`$KEY`',ii:'`.k`'},
    //   }
    //   console.log('src',src)
    //   console.log('pat',pat)
    //   console.log('out',transform(src,pat))
    //   // console.log('src',src)
    // })
    /*
   
   
   
      */
});
function walkpath(_key, val, _parent, path) {
    return 'string' === typeof val ? val + '~' + path.join('.') : val;
}
//# sourceMappingURL=struct.test.js.map