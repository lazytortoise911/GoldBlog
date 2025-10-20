---
title: "12 案例分析：并行计算让代码“飞“起来"
index: true
icon: chart-simple
---

## 并行获取数据

@startmindmap
caption: 要求：部分数据可以留白，但响应数据必须保证

* 服务接口\n50ms内返回
  ** 并行计算\n结果汇总
  *** 1
  *** 2
  *** ...
  *** 20
@endmindmap

下面这段代码，是我专门为这个场景封装的一个工具类。它传入了两个参数：一个是要计算的 job 数量，另外一个是整个大任务超时的毫秒数。

```java
public class ParallelFetcher { 
    final long timeout; 
    final CountDownLatch latch; 
    final ThreadPoolExecutor executor = new ThreadPoolExecutor(100, 200, 1, 
            TimeUnit.HOURS, new ArrayBlockingQueue<>(100)); 
    public ParallelFetcher(int jobSize, long timeoutMill) { 
        latch = new CountDownLatch(jobSize); 
        timeout = timeoutMill; 
    } 
    public void submitJob(Runnable runnable) { 
        executor.execute(() -> { 
            runnable.run(); 
            latch.countDown(); 
        }); 
    } 
    public void await() { 
        try { 
            this.latch.await(timeout, TimeUnit.MILLISECONDS); 
        } catch (InterruptedException e) { 
            throw new IllegalStateException(); 
        } 
    } 
    public void dispose() { 
        this.executor.shutdown(); 
    } 
}
```

我们再来看一下线程池的设置，里面有非常多的参数，最大池数量达到了 200 个。那线程数到底设置多少合适呢？按照我们的需求，每次请求需要执行
20 个线程，200 个线程就可以支持 10 个并发量，按照最悲观的 50ms 来算的话，这个接口支持的最小 QPS 就是：1000/50*
10=200。这就是说，如果访问量增加，这个线程数还可以调大。

### I/O密集型任务

对于我们常见的互联网服务来说，大多数是属于 I/O 密集型的，比如等待数据库的 I/O，等待网络 I/O 等。在这种情况下，当线程数量等于
I/O 任务的数量时，效果是最好的。虽然线程上下文切换会有一定的性能损耗，但相对于缓慢的 I/O 来说，这点损失是可以接受的。

上面说的这种情况，是针对同步 I/O 来说的，基本上是一个任务对应一个线程。异步 NIO 会加速这个过程

### 计算密集型任务

计算密集型的任务却正好相反，比如一些耗时的算法逻辑。CPU 要想达到最高的利用率，提高吞吐量，最好的方式就是：让它尽量少地在任务之间切换，此时，线程数等于
CPU 数量，是效率最高的。

了解了任务的这些特点，就可以通过调整线程数量增加服务性能。比如，高性能的网络工具包 Netty，EventLoop 默认的线程数量，就是处理器的
2 倍。如果我们的业务 I/O 比较耗时，此时就容易造成任务的阻塞，解决方式有两种：一是提高 worker 线程池的大小，另外一种方式是让耗时的操作在另外的线程池里运行。

## 从池化对象原理看线程池

线程的资源也是比较昂贵的，频繁地创建和销毁同样会影响系统性能。线程资源是非常适合进行池化的。

```java
public ThreadPoolExecutor(int corePoolSize, 
    int maximumPoolSize, 
    long keepAliveTime, 
    TimeUnit unit, 
    BlockingQueue<Runnable> workQueue, 
    ThreadFactory threadFactory, 
    RejectedExecutionHandler handler)
```

如下图所示，任务被提交后，首先判断它是否达到了最小线程数（coreSize），如果达到了，就将任务缓存在任务队列里。如果队列也满了，会判断线程数量是否达到了最大线程数（maximumPoolSize），如果也达到了，就会进入任务的拒绝策略（handler）。
@startuml
start
:提交任务;
if (是否达到corePoolSize) then (yes)
if (队列满) then (yes)
if (是否达到maximunPoolSize) then (yes)
#Orange:拒绝策略;
else (no)
:创建任务;
endif
else (no)
:存入队列;
endif
else (no)
:创建任务;
endif
end
@enduml


我们来看一下 Executors 工厂类中默认的几个快捷线程池代码。

### 1.固定大小线程池

```java
public static ExecutorService newFixedThreadPool(int nThreads) { 
    return new ThreadPoolExecutor(nThreads, nThreads, 
     0L, TimeUnit.MILLISECONDS, 
    new LinkedBlockingQueue<Runnable>()); 
}
```

FixedThreadPool 的最大最小线程数是相等的，其实设置成不等的也不会起什么作用。主要原因就是它所采用的任务队列
LinkedBlockingQueue 是无界的，代码走不到判断最大线程池的逻辑。keepAliveTime
参数的设置，也没有意义，因为线程池回收的是corePoolSize和maximumPoolSize 之间的线程。
这个线程池的问题是，由于队列是无界的，在任务较多的情况下，会造成内存使用不可控，同时任务也会在队列里长时间等待。

### 2.无限大小线程池

```java
public static ExecutorService newCachedThreadPool() { 
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE, 
       60L, TimeUnit.SECONDS, 
       new SynchronousQueue<Runnable>()); 
}
```

CachedThreadPool 是另外一个极端，它的最小线程数是 0，线程空闲 1 分钟的都会被回收。在提交任务时，使用了
SynchronousQueue，不缓存任何任务，直接创建新的线程。这种方式同样会有问题，因为它同样无法控制资源的使用，很容易造成内存溢出和过量的线程创建。
一般在线上，这两种方式都不推荐，我们需要根据具体的需求，使用 ThreadPoolExecutor 自行构建线程池，这也是阿里开发规范中推荐的方式。

- 如果任务可以接受一定时间的延迟，那么使用 LinkedBlockingQueue 指定一个队列的上限，缓存一部分任务是合理的；
- 如果任务对实时性要求很高，比如 RPC 服务，就可以使用 SynchronousQueue 队列对任务进行传递，而不是缓存它们。

### 3.拒绝策略

- AbortPolicy：直接抛出异常，默认策略
- CallerRunsPolicy：用调用者所在的线程来执行任务
- DiscardOldestPolicy：丢弃阻塞队列中最靠前的任务，并执行当前任务，将任务加入队列中；
- DiscardPolicy：直接丢弃任务，什么也不做；

## SpringBoot中如何使用异步？

启动类上加上 @EnableAsync 注解，然后在需要异步执行的方法上加上 @Async 注解。默认情况下，Spring
将启动一个默认的线程池供异步任务使用。这个线程池也是无限大的，资源使用不可控，所以强烈建议你使用代码设置一个适合自己的。

## 多线程资源盘点

### 1.线程安全的类

- StringBuilder 对应着 StringBuffer。后者主要是通过 synchronized 关键字实现了线程的同步。值得注意的是，在单个方法区域里，这两者是没有区别的，JIT
  的编译优化会去掉 synchronized 关键字的影响。
- HashMap 对应着 ConcurrentHashMap。ConcurrentHashMap 的话题很大，这里提醒一下 JDK1.7 和 1.8 之间的实现已经不一样了。1.8
  已经去掉了分段锁的概念（锁分离技术），并且使用 synchronized 来代替了 ReentrantLock。
- ArrayList 对应着 CopyOnWriteList。后者是写时复制的概念，适合读多写少的场景。
- LinkedList 对应着 ArrayBlockingQueue。ArrayBlockingQueue 对默认是不公平锁，可以修改构造参数，将其改成公平阻塞队列，它在
  concurrent 包里使用得非常频繁。
- HashSet 对应着 CopyOnWriteArraySet。

SimpleDateFormat内部使用共享的`Calendar`来存储和操作日期数据，多线程同时调用`SimpleDateFormat`的方法（如format()或parse()
），内部的Calendar状态会不一致，解决方式是使用ThreadLocal局部变量。

### 2.线程的同步方式

Java 中实现线程同步的方式有很多，大体可以分为以下 8 类。

- 使用 Object 类中的 wait、notify、notifyAll 等函数。由于这种编程模型非常复杂，现在已经很少用了。这里有一个关键点，那就是对于这些函数的调用，必须放在同步代码块里才能正常运行。
- 使用 ThreadLocal 线程局部变量的方式，每个线程一个变量，本课时会详细讲解。
- 使用 synchronized 关键字修饰方法或者代码块。这是 Java 中最常见的方式，有锁升级的概念。
- 使用 Concurrent 包里的可重入锁 ReentrantLock。使用 CAS 方式实现的可重入锁。
- 使用 volatile 关键字控制变量的可见性，这个关键字保证了变量的可见性，但不能保证它的原子性。
- 使用线程安全的阻塞队列完成线程同步。比如，使用 LinkedBlockingQueue 实现一个简单的生产者消费者。
- 使用原子变量。Atomic* 系列方法，也是使用 CAS 实现的，关于 CAS，我们将在下一课时介绍。
- 使用 Thread 类的 join 方法，可以让多线程按照指定的顺序执行。

使用 LinkedBlockingQueue 实现的一个简单生产者和消费者实例，使用了一个 volatile 修饰的变量，来决定程序是否继续运行，这也是
volatile 变量的常用场景。

```java
public class ProducerConsumerDemo {

    private static final int size = 100;

    private static LinkedBlockingQueue<String> queue = new LinkedBlockingQueue<>(size);

    private static volatile boolean stop = false;

    public static void main(String[] args) {
        Thread consumer1 = new Thread(new Consumer(), "consumer1");
        Thread consumer2 = new Thread(new Consumer(), "consumer2");
        Thread producer = new Thread(new Producer(), "producer");

        producer.start();
        consumer1.start();
        consumer2.start();
    }

    static class Consumer implements Runnable{
        @Override
        public void run() {
            while (!stop) {
                try {
                    Thread.sleep(1000);
                    String take = queue.take();
                    System.out.println(Thread.currentThread().getName() + "|" + take + "|" + queue.size());
                } catch (InterruptedException e) {
                    System.out.println(e.getMessage());
                }
            }
        }
    }

    static class Producer implements Runnable{
        @Override
        public void run() {
            while (!stop) {
                try {
                    Thread.sleep(10);
                    String value = "" + Math.random();
                    queue.put(value);
                    System.out.println(Thread.currentThread().getName() + "|" + value);
                } catch (InterruptedException e) {
                    System.out.println(e.getMessage());
                }
            }
        }
    }
}
```

## FastThreadLocal

Spring 事务管理的传播机制，就是使用 ThreadLocal 实现的。因为 ThreadLocal 是线程私有的，所以 Spring 的事务传播机制是不能够跨线程的。在问到
Spring 事务管理是否包含子线程时，要能够想到面试官的真实意图。

```java
/** 
    * Holder to support the {@code currentTransactionStatus()} method, 
    * and to support communication between different cooperating advices 
    * (e.g. before and after advice) if the aspect involves more than a 
    * single method (as will be the case for around advice). 
*/ 
private static final ThreadLocal<TransactionInfo> transactionInfoHolder = 
        new NamedThreadLocal<>("Current aspect-driven transaction");
```

Thread 类中，有一个成员变量 ThreadLocals，存放了与本线程相关的所有自定义信息。对这个变量的定义在 Thread 类，而操作却在
ThreadLocal 类中。

既然Java中有了ThreadLocal类，为什么Netty还创建了FastThreadLocal的结构？

问题就出在 ThreadLocalMap 类上，它虽然叫 Map，但却没有实现 Map 的接口。如下图，ThreadLocalMap 在 rehash 的时候，并没有采用类似
HashMap 的数组+链表+红黑树的做法，它只使用了一个数组，使用**开放寻址**（遇到冲突，依次查找，直到空闲位置）的方法，这种方式是非常低效的。

```java

private void resize() {
  Entry[] oldTab = table;
  int oldLen = oldTab.length;
  int newLen = oldLen * 2;
  Entry[] newTab = new Entry[newLen];
  int count = 0;

  for (int j = 0; j < oldLen; ++j) {
    Entry e = oldTab[j];
    if (e != null) {
      ThreadLocal<?> k = e.get();
      if (k == null) {
        e.value = null; // Help the GC
      } else {
        int h = k.threadLocalHashCode & (newLen - 1);
        while (newTab[h] != null)
          h = nextIndex(h, newLen);
        newTab[h] = e;
        count++;
      }
    }
  }

  setThreshold(newLen);
  size = count;
  table = newTab;
}
```

由于 Netty 对 ThreadLocal 的使用非常频繁，Netty 对它进行了专项的优化。它之所以快，是因为在底层数据结构上做了文章，使用常量下标对元素进行定位，而不是使用JDK
默认的探测性算法。

## 多线程使用中遇到的问题

- 线程池的不正确使用，造成了资源分配的不可控；
- I/O 密集型场景下，线程池开得过小，造成了请求的频繁失败；
- 线程池使用了 CallerRunsPolicy 饱和策略，造成了业务线程的阻塞；
- SimpleDateFormat 造成的时间错乱。

多线程环境中，异常日志是非常重要的，但线程池的默认行为并不是特别切合实际。参见如下代码，任务执行时，抛出了一个异常，但我们的终端什么都没输出，异常信息丢失了，这对问题排查非常不友好。

```java
public static void main(String[] args) {
  ExecutorService executor = Executors.newCachedThreadPool();
  executor.submit(()-> {
    String s = null;
    System.out.println(s.toString());
    s.substring(0);
  });
  executor.shutdown();
}
```

在ThreadPoolExecutor中可以找到任务发生异常时的方法，它是抛给了afterExecute方法进行处理

```java
final void runWorker(Worker w) {
        Thread wt = Thread.currentThread();
        Runnable task = w.firstTask;
        w.firstTask = null;
        w.unlock(); // allow interrupts
        boolean completedAbruptly = true;
        try {
            while (task != null || (task = getTask()) != null) {
                w.lock();
                // If pool is stopping, ensure thread is interrupted;
                // if not, ensure thread is not interrupted.  This
                // requires a recheck in second case to deal with
                // shutdownNow race while clearing interrupt
                if ((runStateAtLeast(ctl.get(), STOP) ||
                     (Thread.interrupted() &&
                      runStateAtLeast(ctl.get(), STOP))) &&
                    !wt.isInterrupted())
                    wt.interrupt();
                try {
                    beforeExecute(wt, task);
                    Throwable thrown = null;
                    try {
                        task.run();
                    } catch (RuntimeException x) {
                        thrown = x; throw x;
                    } catch (Error x) {
                        thrown = x; throw x;
                    } catch (Throwable x) {
                        thrown = x; throw new Error(x);
                    } finally {
                        afterExecute(task, thrown);
                    }
                } finally {
                    task = null;
                    w.completedTasks++;
                    w.unlock();
                }
            }
            completedAbruptly = false;
        } finally {
            processWorkerExit(w, completedAbruptly);
        }
    }
```

submit方法会将任务包装为FutureTask，执行run方法的异常会被封装在Future中，无法走到afterExecute。
~~ThreadPoolExecutor 中的 afterExecute 方法是没有任何实现的，它是个空方法。~~
execute方法执行的是Runnable方法，遇到异常后捕获后会继续抛出。

```java
protected void afterExecute(Runnable r, Throwable t) { }
```

如果你通过重写 afterExecute 来改变这个默认行为，但这代价点大。其实，**使用 submit 方法提交的任务，会返回一个 Future
对象，只有调用了它的 get 方法，这个异常才会打印**。使用 submit 方法提交的任务，代码永远不会走到上图标红的一行，获取异常的方式有且只有这一种。

只有使用 execute 方法提交的任务才会走到这行异常处理代码。如果你想要默认打印异常，推荐使用 execute 方法提交任务，它和 submit
方法的区别，也不仅仅是返回值不一样那么简单。

## 关于异步

::: important
异步，并没有减少任务的执行步骤，也没有算法上的改进，那么为什么说异步的速度更快呢
:::

**异步是一种编程模型，它通过将耗时的操作转移到后台线程运行，从而减少对主业务的阻塞，所以说一步让速度变快了**
。如果系统资源使用已经到了极限，异步就不能产生任何效果了，主要优化的是阻塞性的等待。

异步可以对业务进行解耦，像生产者消费者模型，主线程负责生产任务，将它存放在执行列表中；消费线程池负责任务的消费，进行真正的业务逻辑处理。
@startuml
[*] -> 主线程
主线程 -> 任务池 #Orange : 生产任务
任务池 -> 主线程 : 快速返回
任务池 -> 消费线程池 #Green : 消费
消费线程池 -down-> 实际业务 #Yellow
消费线程池 -down-> 共享资源 #Yellow
@enduml

## 小结

多线程的话题很大，本课时的内容稍微多，我们简单总结一下课时重点。

本课时默认你已经有了多线程的基础知识（否则看起来会比较吃力），所以我们从 CountDownLatch 的一个实际应用场景说起，谈到了线程池的两个重点：
**阻塞队列**和**拒绝策略**。

接下来，我们学习了如何在常见的框架 **SpringBoot 中配置任务异步执行**
。我们还对多线程的一些重要知识点进行了盘点，尤其看了一些线程安全的工具，以及线程的同步方式。最后，我们对最常用的 *
*ThreadLocal** 进行了介绍，并了解了 Netty 对这个工具类的优化。

本课时的所有问题，都是面试高频考点。 多线程编程的难点除了 API 繁多复杂外，还在于异步编程的模式很难调试。

我们也对比较难回答的使用经验问题，进行了专题讨论，例如“你在多线程使用中遇到的一些问题以及解决方法”，这种问题被问到的概率还是很高的。
