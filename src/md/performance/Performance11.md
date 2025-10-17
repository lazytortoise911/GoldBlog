---
title: "11 案例分析：如何用设计模式优化性能"
index: true
icon: chart-simple
---

## 如何找到动态代理慢逻辑的原因？

使用 arthas 找到动态代理慢逻辑的具体原因

## 代理模式

代理模式（Proxy）可以通过一个代理类，来控制对一个对象的访问。

Java 中实现动态代理主要有两种模式：一种是使用 JDK，另外一种是使用 CGLib。

- 其中，JDK 方式是面向接口的，主 要的相关类是 InvocationHandler 和 Proxy；
- CGLib 可以代理普通类，主要的相关类是 MethodInterceptor 和 Enhancer。

JDK 动态代理和 CGLib 代理的创建速度和执行速度，在新版本的 Java 中差别并不是很大，Spring 选用了 CGLib，主要是因为它能够代理普通类的缘故。

## 单例模式

@startuml
start
:加载 Loading;
group Linking
:验证 Verifying;
:准备 Preparing;
:解析 Resolving;
end group
:初始化 Initializing;
stop
@enduml

JVM类加载机制，static 字段和 static 代码块，是属于类的，在类加载的初始化阶段就已经被执行。它在字节码中对应的是
方法，属于类的（构造方法）。 因为类的初始化只有一次，所以它就能够保证这个加载动作是线程安全的。

根据以上原理，只要把单例的初始化动作，放在方法中就能实现**饿汉模式**。

```java
private static Singleton instace = new Singleton();
```

1. 资源浪费，生成的对象可能用不到
2. 并发问题，调用构造方法需要线程同步

双重校验锁的单例模式

```java
public class Singleton {
    
    private static volatile Singleton INSTANCE = null;
    
    private Singleton() {
    }
    
    public Singleton getInstance() {
        if (INSTANCE == null) {
            synchronized (Singleton.class) {
                if (INSTANCE == null) {
                    INSTANCE = new Singleton();
                }
            }
        } 
        return INSTANCE;
    }
    
}
```

volatile关键字的作用：防止指令重排序，构造函数分为三个步骤，**分配内存空间，初始化对象，将内存空间的地址赋值给对应的引用**
，多线程情况下导致未初始化的引用被其他线程使用。

推荐使用enum实现懒加载的单例：

```java
public class EnumSingleton { 
    private EnumSingleton() { 
    } 
    public static EnumSingleton getInstance() { 
        return Holder.HOLDER.instance; 
    } 
    private enum Holder { 
        HOLDER; 
        private final EnumSingleton instance; 
        Holder() { 
            instance = new EnumSingleton(); 
        } 
    } 
} 
```

## 享元模式

::: tip
享元模式（Flyweight）是难得的，专门针对性能优化的设计模式，它通过共享技术，最大限度地复用对象。享元模式一般会使用唯一的标识码进行判断，
然后返回对应的对象，使用 HashMap 一类的集合存储非常合适。
:::

同样的代码，不同的解释，会产生不同的效果。比如下面这段代码：

```java
Map<String,Strategy> strategys = new HashMap<>(); 
strategys.put("a",new AStrategy()); 
strategys.put("b",new BStrategy()); 
```

如果我们从对象复用的角度来说，它就是享元模式；如果我们从对象的功能角度来说，那它就是策略模式。所以大家在讨论设计模式的时候，一定要注意上下文语境的这些差别。

## 原型模式

::: tip
原型模式（Prototype）比较类似于复制粘贴的思想，它可以首先创建一个实例，然后通过这个实例进行新对象的创建。在 Java 中，最典型的就是
Object 类的 clone 方法。
:::

但编码中这个方法很少用，我们上面在代理模式提到的 prototype，并不是通过 clone 实现的，而是使用了更复杂的反射技术。

clone 如果只拷贝当前层次的对象，实现的只是浅拷贝。在现实情况下，对象往往会非常复杂，想要实现深拷贝的话，需要在 clone
方法里做大量的编码，远远不如调用 new 方法方便。

深拷贝：实现深拷贝，还有序列化等手段，比如实现 Serializable 接口，或者把对象转化成 JSON。

在现实情况下，**原型模式变成了一种思想，而不是加快对象创建速度的工具。**

## 小结

本课时，我们主要看了几个与性能相关的设计模式，包括一些高频的考点。我们了解到了 Java 实现动态代理的两种方式，以及他们的区别，在现版本的
JVM 中，性能差异并不大；我们还了解到单例模式的三种创建方式，并看了一个 double check
的反例，平常编码中，推荐使用枚举去实现单例；最后，我们学习了享元模式和原型模式，它们概念性更强一些，并没有固定的编码模式。

我们还顺便学习了 arthas 使用 trace 命令，寻找耗时代码块的方法，最终将问题定位到 Spring 的 AOP
功能模块里，而这种场景在复杂项目中经常发生，需要你特别注意。

此外，在设计模式中，对性能帮助最大的是生产者消费者模式，比如异步消息、reactor 模型等，而这一部分内容，我们将在之后的《15 |
案例分析：从 BIO 到 NIO，再到 AIO》中详细讲解。

不过，想要了解这方面的内容，需要首先了解一些多线程编程的知识，所以下一课时，我将讲解并行计算的一些知识点，记得按时来听课。