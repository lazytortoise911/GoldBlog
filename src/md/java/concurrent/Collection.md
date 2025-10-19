---
title: "Collection"
index: true
icon: chart-simple
---

## 什么是ThreadLocal？用来解决什么问题？

线程安全的解决思路：

- 互斥同步：synchronized 和 ReentrantLock
- 非阻塞同步： CAS，Atomic原子类
- 无同步方案：栈封闭，本地存储（Thread Local），可重入代码

总结：ThreadLocal是一个将在多线程中为每一个线程创建单独的变量副本的类；使用ThreadLocal来维护变量时,
ThreadLocal会为每个线程创建单独的变量副本, 避免因多线程操作共享变量而导致的数据不一致的情况。

